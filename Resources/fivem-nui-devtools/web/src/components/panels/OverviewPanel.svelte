<script lang="ts">
  import { devtools } from '../../state/devtools.svelte';
  import { finite, formatBytes, formatRate } from '../../utils/format';

  const sample = $derived(devtools.selectedState?.latest);
  const history = $derived(devtools.selectedState?.history ?? []);
  const geos = $derived(devtools.chartGeometries);

  const incoming = $derived(finite(sample?.incomingPerSecond));
  const outgoing = $derived(finite(sample?.outgoingPerSecond));
  const messagesPerSecond = $derived(finite(sample?.messagesPerSecond));
  const latency = $derived(finite(sample?.averageResponseMs));
  const bytesPerSecond = $derived(finite(sample?.bytesPerSecond));
  const completed = $derived(sample?.completedRequests ?? 0);
  const failures = $derived(sample?.failedMessages ?? 0);
  const totalMessages = $derived(sample?.totalMessages ?? 0);
  const totalBytes = $derived(sample?.totalBytes ?? 0);
  const peak = $derived(sample?.largestPayloadBytes ?? 0);

  const inShare = $derived(devtools.inboundShare);
  const outShare = $derived(100 - inShare);
  const health = $derived(devtools.healthPercent);
</script>

<section class="panel" class:active={devtools.activeTab === 'overview'}>
  <div class="metrics">
    <article>
      <span>Throughput</span>
      <strong>{formatRate(messagesPerSecond)}<em> msg/s</em></strong>
      <small>
        <b class="in">↓ {formatRate(incoming)}</b>
        <b class="out">↑ {formatRate(outgoing)}</b>
      </small>
    </article>

    <article>
      <span>Mean response</span>
      <strong>{latency.toFixed(2)}<em> ms</em></strong>
      <small>{completed.toLocaleString()} completed</small>
    </article>

    <article>
      <span>Bandwidth</span>
      <strong>{formatBytes(bytesPerSecond)}/s</strong>
      <small>{formatBytes(totalBytes)} total</small>
    </article>

    <article>
      <span>Success rate</span>
      <strong class:has-errors={health < 99}>{health.toFixed(health === 100 ? 0 : 1)}%</strong>
      <small class:has-errors={failures > 0}>{failures.toLocaleString()} failures</small>
    </article>
  </div>

  <div class="direction">
    <div><span>Inbound</span><b>{inShare.toFixed(0)}%</b></div>
    <div class="direction-track">
      <i style="width: {inShare}%"></i>
    </div>
    <div><span>Outbound</span><b>{outShare.toFixed(0)}%</b></div>
  </div>

  <div class="charts">
    <article class="chart traffic">
      <div>
        <span>Message rate <small>last 60 seconds</small></span>
        <b>{formatRate(messagesPerSecond)} msg/s</b>
      </div>
      <svg viewBox="0 0 600 58" preserveAspectRatio="none">
        <path class="grid" d="M0 14H600 M0 29H600 M0 44H600" />
        <polygon points={geos.messagesPerSecond.fill} />
        <polyline points={geos.messagesPerSecond.line} />
      </svg>
    </article>

    <article class="chart latency-chart">
      <div>
        <span>Response time</span>
        <b>{latency.toFixed(2)} ms</b>
      </div>
      <svg viewBox="0 0 600 58" preserveAspectRatio="none">
        <path class="grid" d="M0 14H600 M0 29H600 M0 44H600" />
        <polygon points={geos.averageResponseMs.fill} />
        <polyline points={geos.averageResponseMs.line} />
      </svg>
    </article>

    <article class="chart bytes-chart">
      <div>
        <span>Bandwidth</span>
        <b>{formatBytes(bytesPerSecond)}/s</b>
      </div>
      <svg viewBox="0 0 600 58" preserveAspectRatio="none">
        <path class="grid" d="M0 14H600 M0 29H600 M0 44H600" />
        <polygon points={geos.bytesPerSecond.fill} />
        <polyline points={geos.bytesPerSecond.line} />
      </svg>
    </article>
  </div>

  <div class="totals">
    <article>
      <span>Total envelopes</span>
      <b>{totalMessages.toLocaleString()}</b>
    </article>
    <article>
      <span>Largest payload</span>
      <b>{formatBytes(peak)}</b>
    </article>
    <article>
      <span>Provider count</span>
      <b>{Math.max(devtools.visibility.providerCount, devtools.providerNames.length)}</b>
    </article>
    <article>
      <span>History</span>
      <b>{history.length} / 60</b>
    </article>
  </div>
</section>
