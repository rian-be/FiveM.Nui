<script lang="ts">
  import { onMount } from 'svelte';
  import { isBrowser, nui } from '@fivem-nui/svelte';
  import { devtools, postNui } from './state/devtools.svelte';
  import type {
    DiagnosticAlert,
    DiagnosticsSample,
    ResourceInventory,
    ResourceLifecycleEntry,
    SessionState,
    VisibilityState
  } from './types';

  import Header from './components/Header.svelte';
  import AlertsBanner from './components/AlertsBanner.svelte';
  import Toolbar from './components/Toolbar.svelte';
  import OverviewPanel from './components/panels/OverviewPanel.svelte';
  import MetricsPanel from './components/panels/MetricsPanel.svelte';
  import TimelinePanel from './components/panels/TimelinePanel.svelte';
  import ResourcesPanel from './components/panels/ResourcesPanel.svelte';
  import WaitingOverlay from './components/WaitingOverlay.svelte';
  import Footer from './components/Footer.svelte';
  import ExportModal from './components/ExportModal.svelte';

  const isBrowserPreview = isBrowser();

  onMount(() => {
    // 1. Register NUI event handlers through @fivem-nui/svelte
    const unsubs: Array<() => void> = [];

    unsubs.push(
      nui.on('devtools:visibility', (payload) => {
        const state = payload as VisibilityState;
        devtools.visibility = {
          visible: Boolean(state.visible),
          connected: Boolean(state.connected),
          interactive: Boolean(state.interactive),
          providerCount: state.providerCount ?? 0
        };
      })
    );

    unsubs.push(
      nui.on('devtools:snapshot', (payload) => {
        devtools.acceptSnapshot(payload as DiagnosticsSample);
      })
    );

    unsubs.push(
      nui.on('devtools:snapshots', (payload) => {
        const batch = payload as { timestamp: number; providers: DiagnosticsSample[] };
        if (Array.isArray(batch?.providers)) {
          for (const s of batch.providers) {
            devtools.acceptSnapshot(s);
          }
        }
      })
    );

    unsubs.push(
      nui.on('devtools:providerRemoved', (payload) => {
        const removed = payload as { source: string; reason: string };
        if (removed?.source) {
          devtools.removeProvider(removed.source);
        }
      })
    );

    unsubs.push(
      nui.on('devtools:resources', (payload) => {
        devtools.resourceInventory = payload as ResourceInventory;
      })
    );

    unsubs.push(
      nui.on('devtools:resourceLifecycle', (payload) => {
        const entry = payload as ResourceLifecycleEntry;
        if (entry && entry.resource) {
          const existing = devtools.resourceInventory.lifecycle ?? [];
          if (!existing.some((e) => e.resource === entry.resource && e.state === entry.state && Math.abs(e.timestamp - entry.timestamp) < 1200)) {
            devtools.resourceInventory.lifecycle = [entry, ...existing].slice(0, 100);
          }
        }
      })
    );

    unsubs.push(
      nui.on('devtools:alerts', (payload) => {
        devtools.alertsList = (payload as DiagnosticAlert[]) ?? [];
      })
    );

    unsubs.push(
      nui.on('devtools:sessionState', (payload) => {
        devtools.sessionState = payload as SessionState;
      })
    );

    unsubs.push(
      nui.on('devtools:exportData', (payload) => {
        void devtools.handleExportData(payload);
      })
    );

    // 2. Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (devtools.exportModalOpen) {
          devtools.exportModalOpen = false;
          return;
        }
        if (devtools.selectedOperation) {
          devtools.selectedOperation = null;
          return;
        }
        devtools.close();
        return;
      }

      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'p') devtools.togglePause();
      if (key === 'c') devtools.clearHistory();
      if (key === 'm') devtools.toggleCompact();
    };

    window.addEventListener('keydown', handleKeyDown);

    // 3. Initialize or run browser simulation
    let simTimer: number | undefined;

    if (!isBrowserPreview) {
      void postNui('ready');
    } else {
      // Browser preview mode
      devtools.visibility = {
        visible: true,
        connected: true,
        interactive: true,
        providerCount: 2
      };

      devtools.resourceInventory = {
        timestamp: Date.now(),
        resources: [
          { name: 'chat', state: 'started', version: '1.0.0', author: 'Cfx.re', description: 'Chat for FiveM', hasNui: true, isDiagnosticsProvider: false },
          { name: 'comps-demo-project-reference', state: 'started', version: '1.6.4', author: 'FiveM.Nui', description: 'Component demo suite', dependencies: ['chat'], hasNui: true, isDiagnosticsProvider: true },
          { name: 'fivem-nui-devtools', state: 'started', version: '1.6.4', author: 'FiveM.Nui', description: 'Diagnostic inspection tool', dependencies: ['chat'], hasNui: true, isDiagnosticsProvider: false },
          { name: 'hud', state: 'started', version: '1.0.0', author: 'Server', description: 'Player HUD', hasNui: true, isDiagnosticsProvider: true }
        ],
        lifecycle: [
          { timestamp: Date.now() - 5000, resource: 'hud', state: 'started' },
          { timestamp: Date.now() - 12000, resource: 'hud', state: 'stopped' },
          { timestamp: Date.now() - 35000, resource: 'comps-demo-project-reference', state: 'started' }
        ]
      };

      let totalMessages = 840;
      let totalBytes = 1_240_000;

      simTimer = window.setInterval(() => {
        const messagesPerSecond = 14 + Math.random() * 26;
        const bytesPerSecond = 8_000 + Math.random() * 22_000;
        totalMessages += Math.round(messagesPerSecond);
        totalBytes += Math.round(bytesPerSecond);

        devtools.acceptSnapshot({
          version: 1,
          source: 'comps-demo-project-reference',
          timestamp: Date.now(),
          messagesPerSecond,
          incomingPerSecond: messagesPerSecond * 0.42,
          outgoingPerSecond: messagesPerSecond * 0.58,
          averageResponseMs: 0.7 + Math.random() * 3.8,
          bytesPerSecond,
          totalMessages,
          totalBytes,
          largestPayloadBytes: 12_840,
          completedRequests: 824,
          failedMessages: 2,
          counters: {
            'nui.sent': totalMessages,
            'nui.received': Math.round(totalMessages * 0.42)
          },
          timings: {
            'request.average': 18420,
            'callback.average': 6290
          },
          operations: [
            {
              sequence: Math.round(Math.random() * 100000),
              timestamp: Date.now(),
              direction: Math.random() > 0.5 ? 'inbound' : 'outbound',
              type: 'event',
              event: 'hud:updateStats',
              payloadBytes: Math.round(128 + Math.random() * 1024),
              durationMs: Math.round(2 + Math.random() * 8),
              status: 'success'
            }
          ]
        });
      }, 1000);
    }

    return () => {
      unsubs.forEach((u) => u());
      window.removeEventListener('keydown', handleKeyDown);
      if (simTimer) clearInterval(simTimer);
    };
  });
</script>

<aside
  id="devtools"
  class="devtools"
  class:visible={devtools.visibility.visible}
  class:interactive={devtools.visibility.interactive}
  class:compact={devtools.compact}
  data-connected={devtools.status === 'LIVE' ? 'true' : devtools.status === 'STALE' ? 'stale' : 'false'}
  aria-label="FiveM NUI live diagnostics"
>
  <Header />
  <AlertsBanner />
  <Toolbar />

  <main>
    <OverviewPanel />
    <MetricsPanel />
    <TimelinePanel />
    <ResourcesPanel />
    <WaitingOverlay />
  </main>

  <Footer />
  <ExportModal />
</aside>
