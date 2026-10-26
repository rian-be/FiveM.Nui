import { isNui } from '@fivem-nui/svelte';
import type {
  DiagnosticAlert,
  DiagnosticOperation,
  DiagnosticsSample,
  ProviderState,
  ResourceInfo,
  ResourceInventory,
  ResourceLifecycleEntry,
  ResourceSubtab,
  SessionState,
  Tab,
  VisibilityState
} from '../types';
import {
  computeAggregateSample,
  computeHealthPercent,
  computeInboundShare,
  computeResourceCounts
} from '../utils/aggregates';
import { copyText, downloadJson } from '../utils/clipboard';
import { chartGeometry, resourceGroup } from '../utils/format';
import { postNui } from '../utils/nui';

export { copyText, downloadJson, postNui };
export const ALL_PROVIDERS = '__all__';

export class DevToolsStore {
  // Navigation & View mode
  activeSource = $state<string>(ALL_PROVIDERS);
  activeTab = $state<Tab>('overview');
  activeResourceSubtab = $state<ResourceSubtab>('inventory');
  paused = $state<boolean>(false);
  compact = $state<boolean>(false);

  // Platform & visibility state
  visibility = $state<VisibilityState>({
    visible: false,
    connected: false,
    interactive: false,
    providerCount: 0
  });

  // Providers & metrics data
  providers = $state<Record<string, ProviderState>>({});
  aggregateHistory = $state<DiagnosticsSample[]>([]);
  resourceInventory = $state<ResourceInventory>({ timestamp: 0, resources: [], lifecycle: [] });
  alertsList = $state<DiagnosticAlert[]>([]);
  alertsOpen = $state<boolean>(false);
  sessionState = $state<SessionState>({ isRecording: false, frameCount: 0, durationMs: 0 });

  // Filtering & selection
  selectedOperation = $state<{ source: string; operation: DiagnosticOperation } | null>(null);
  timelineSearch = $state<string>('');
  timelineDirection = $state<string>('all');
  resourceSearch = $state<string>('');
  resourceFilter = $state<string>('all');

  // Export Modal
  exportModalOpen = $state<boolean>(false);
  exportJson = $state<string>('');
  exportNotice = $state<string>('');
  exportNoticeColor = $state<string>('#45b878');
  exportBtnText = $state<string>('Export');
  exportBtnColor = $state<string>('');

  // Clock tick for freshness calculation
  now = $state<number>(Date.now());

  constructor() {
    setInterval(() => {
      this.now = Date.now();
      if (this.sessionState.isRecording) {
        this.sessionState.frameCount++;
      }
    }, 1_000);
  }

  // --- Derived Metrics & Selectors ---

  providerNames = $derived(Object.keys(this.providers).sort());

  aggregateSample = $derived.by<DiagnosticsSample | null>(() =>
    computeAggregateSample(this.providers, this.now)
  );

  selectedState = $derived.by<ProviderState | undefined>(() => {
    if (this.activeSource === ALL_PROVIDERS) {
      const agg = this.aggregateSample;
      if (!agg) return undefined;
      const latestReceivedAt = Math.max(
        0,
        ...Object.values(this.providers).map((p) => p.receivedAt)
      );
      return {
        latest: agg,
        history: this.aggregateHistory,
        operations: [],
        receivedAt: latestReceivedAt
      };
    }
    return this.providers[this.activeSource];
  });

  hasActiveData = $derived(Object.keys(this.providers).length > 0);

  status = $derived.by<'WAITING' | 'PAUSED' | 'STALE' | 'LIVE'>(() => {
    if (this.paused) return 'PAUSED';
    if (!this.selectedState) return 'WAITING';
    const age = Math.max(0, this.now - this.selectedState.receivedAt);
    if (age > 3_500) return 'STALE';
    return 'LIVE';
  });

  sampleAgeText = $derived.by<string>(() => {
    if (!this.selectedState) return 'no samples';
    const age = Math.max(0, this.now - this.selectedState.receivedAt);
    return age < 1_000 ? 'updated now' : `updated ${(age / 1_000).toFixed(0)}s ago`;
  });

  inboundShare = $derived.by<number>(() =>
    computeInboundShare(this.selectedState?.latest)
  );

  healthPercent = $derived.by<number>(() =>
    computeHealthPercent(this.selectedState?.latest)
  );

  hasAlertErrors = $derived(this.alertsList.some((a) => a.severity === 'error'));

  chartGeometries = $derived.by(() => {
    const history = this.selectedState?.history ?? [];
    return {
      messagesPerSecond: chartGeometry(history, 'messagesPerSecond'),
      averageResponseMs: chartGeometry(history, 'averageResponseMs'),
      bytesPerSecond: chartGeometry(history, 'bytesPerSecond')
    };
  });

  allOperations = $derived.by<Array<{ source: string; operation: DiagnosticOperation }>>(() => {
    const list = this.activeSource === ALL_PROVIDERS
      ? Object.entries(this.providers)
      : this.providers[this.activeSource]
        ? [[this.activeSource, this.providers[this.activeSource]] as const]
        : [];
    return list.flatMap(([src, state]) =>
      state.operations.map((operation) => ({ source: src, operation }))
    );
  });

  filteredTimeline = $derived.by<Array<{ source: string; operation: DiagnosticOperation }>>(() => {
    const query = this.timelineSearch.trim().toLowerCase();
    const dir = this.timelineDirection;
    return this.allOperations
      .filter(({ source, operation }) => {
        const matchesDir = dir === 'all' || operation.direction === dir;
        const matchesQuery =
          !query ||
          source.toLowerCase().includes(query) ||
          operation.event.toLowerCase().includes(query) ||
          operation.type.toLowerCase().includes(query) ||
          operation.status.toLowerCase().includes(query);
        return matchesDir && matchesQuery;
      })
      .sort((a, b) => b.operation.timestamp - a.operation.timestamp)
      .slice(0, 500);
  });

  resourceCounts = $derived.by(() =>
    computeResourceCounts(this.resourceInventory.resources)
  );

  filteredResources = $derived.by<ResourceInfo[]>(() => {
    const resources = this.resourceInventory.resources ?? [];
    const query = this.resourceSearch.trim().toLowerCase();
    const filter = this.resourceFilter;
    return resources.filter((r) => {
      const grp = resourceGroup(r.state);
      const matchesFilter = filter === 'all' || grp === filter;
      const matchesQuery =
        !query ||
        r.name.toLowerCase().includes(query) ||
        Boolean(r.description && r.description.toLowerCase().includes(query));
      return matchesFilter && matchesQuery;
    });
  });

  sortedLifecycle = $derived.by<ResourceLifecycleEntry[]>(() => {
    const list = this.resourceInventory.lifecycle ?? [];
    return [...list].sort((a, b) => b.timestamp - a.timestamp);
  });

  // --- Actions ---

  acceptSnapshot(sample: DiagnosticsSample): void {
    if (!sample || sample.version !== 1 || !sample.source) return;

    let provider = this.providers[sample.source];
    if (!provider) {
      provider = {
        latest: sample,
        history: [],
        operations: [],
        receivedAt: Date.now()
      };
      this.providers = { ...this.providers, [sample.source]: provider };
    }

    if (sample.totalMessages < provider.latest.totalMessages) {
      provider.operations = [];
    }

    const knownSeq = new Set(provider.operations.map((op) => op.sequence));
    const newOps = (sample.operations ?? []).filter((op) => !knownSeq.has(op.sequence));
    provider.operations.push(...newOps);
    if (provider.operations.length > 300) {
      provider.operations.splice(0, provider.operations.length - 300);
    }

    provider.latest = sample;
    provider.receivedAt = Date.now();

    if (!this.paused) {
      provider.history.push(sample);
      if (provider.history.length > 60) provider.history.shift();

      const agg = this.aggregateSample;
      if (agg) {
        const b = Math.floor(agg.timestamp / 1_000);
        const prevB = this.aggregateHistory.length
          ? Math.floor(this.aggregateHistory[this.aggregateHistory.length - 1].timestamp / 1_000)
          : -1;
        if (b === prevB) {
          this.aggregateHistory[this.aggregateHistory.length - 1] = agg;
        } else {
          this.aggregateHistory.push(agg);
          if (this.aggregateHistory.length > 60) this.aggregateHistory.shift();
        }
      }
    }

    this.providers = { ...this.providers, [sample.source]: provider };
  }

  removeProvider(source: string): void {
    if (this.providers[source]) {
      const next = { ...this.providers };
      delete next[source];
      this.providers = next;
      if (this.activeSource === source) {
        this.activeSource = ALL_PROVIDERS;
      }
    }
  }

  togglePause(): void {
    this.paused = !this.paused;
  }

  clearHistory(): void {
    for (const p of Object.values(this.providers)) {
      p.history = [];
    }
    this.aggregateHistory = [];
  }

  clearTimeline(): void {
    for (const p of Object.values(this.providers)) {
      p.operations = [];
    }
    this.selectedOperation = null;
  }

  toggleCompact(): void {
    this.compact = !this.compact;
    if (this.compact) {
      this.activeTab = 'overview';
    }
  }

  toggleRecord(): void {
    this.sessionState.isRecording = !this.sessionState.isRecording;
    if (this.sessionState.isRecording) {
      this.sessionState.frameCount = 0;
    }
    void postNui('devtools:toggleRecord');
  }

  async handleExportData(data: unknown): Promise<void> {
    const json = JSON.stringify(data, null, 2);
    this.exportJson = json;
    this.exportModalOpen = true;

    const copied = await copyText(json);
    if (copied) {
      this.exportNotice = '✔ Session JSON copied to clipboard! You can also select and copy below.';
      this.exportNoticeColor = '#45b878';
      this.exportBtnText = '✔ Copied!';
      this.exportBtnColor = '#45b878';
    } else {
      this.exportNotice = 'Select all (Ctrl+A) and copy (Ctrl+C) the session data below:';
      this.exportNoticeColor = '#e0a040';
      this.exportBtnText = 'Exported';
      this.exportBtnColor = '#e0a040';
    }

    setTimeout(() => {
      this.exportBtnText = 'Export';
      this.exportBtnColor = '';
    }, 2500);
  }

  async requestExport(): Promise<void> {
    this.exportBtnText = 'Exporting...';

    if (isNui()) {
      void postNui('devtools:exportSession');
      setTimeout(async () => {
        if (!this.exportModalOpen) {
          await this.handleExportData({
            startedAt: Date.now() - this.sessionState.frameCount * 1000,
            endedAt: Date.now(),
            frameCount: this.sessionState.frameCount || 1,
            fallback: true,
            providers: Object.values(this.providers).map((p) => p.latest)
          });
        }
      }, 1200);
    } else {
      await this.handleExportData({
        startedAt: Date.now() - this.sessionState.frameCount * 1000,
        endedAt: Date.now(),
        frameCount: this.sessionState.frameCount || 1,
        preview: true,
        providers: Object.values(this.providers).map((p) => p.latest)
      });
    }
  }

  close(): void {
    void postNui('close');
  }
}

export const devtools = new DevToolsStore();
