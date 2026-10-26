<script lang="ts">
  import { devtools } from '../../state/devtools.svelte';
  import { formatBytes } from '../../utils/format';

  const entries = $derived(devtools.filteredTimeline);
  const selected = $derived(devtools.selectedOperation);
</script>

<section class="panel timeline-panel" class:active={devtools.activeTab === 'timeline'}>
  <div class="timeline-tools">
    <input
      type="search"
      placeholder="Filter event or resource…"
      autocomplete="off"
      bind:value={devtools.timelineSearch}
      aria-label="Filter timeline operations"
    />
    <select
      bind:value={devtools.timelineDirection}
      aria-label="Filter timeline by direction"
    >
      <option value="all">All directions</option>
      <option value="outbound">Outbound</option>
      <option value="inbound">Inbound</option>
      <option value="roundtrip">Roundtrip</option>
      <option value="callback">Callback</option>
    </select>
    <button type="button" onclick={() => devtools.clearTimeline()}>Clear</button>
  </div>

  <div class="timeline-head">
    <span>Time</span>
    <span>Resource</span>
    <span>Direction</span>
    <span>Event</span>
    <span>Size</span>
    <span>Duration</span>
    <span>Status</span>
  </div>

  <div class="timeline-rows">
    {#if entries.length === 0}
      <p>
        {devtools.allOperations.length > 0
          ? 'No operations match this filter.'
          : 'No operations recorded.'}
      </p>
    {:else}
      {#each entries as { source, operation } (source + ':' + operation.sequence + ':' + operation.timestamp)}
        <button
          type="button"
          class="timeline-row status-{operation.status}"
          onclick={() => (devtools.selectedOperation = { source, operation })}
        >
          <span title={new Date(operation.timestamp).toLocaleTimeString()}>
            {new Date(operation.timestamp).toLocaleTimeString()}
          </span>
          <span title={source}>{source}</span>
          <span title={operation.direction}>{operation.direction}</span>
          <span title={operation.event || operation.type}>
            {operation.event || operation.type}
          </span>
          <span title={formatBytes(operation.payloadBytes)}>
            {formatBytes(operation.payloadBytes)}
          </span>
          <span title={operation.durationMs == null ? '—' : `${operation.durationMs} ms`}>
            {operation.durationMs == null ? '—' : `${operation.durationMs} ms`}
          </span>
          <span title={operation.status}>{operation.status}</span>
        </button>
      {/each}
    {/if}
  </div>

  {#if selected}
    <aside class="operation-detail">
      <header>
        <strong>{selected.operation.event || selected.operation.type}</strong>
        <button
          type="button"
          onclick={() => (devtools.selectedOperation = null)}
          aria-label="Close operation detail"
        >
          ×
        </button>
      </header>
      <dl>
        <dt>Resource</dt>
        <dd title={selected.source}>{selected.source}</dd>

        <dt>Timestamp</dt>
        <dd title={new Date(selected.operation.timestamp).toLocaleString()}>
          {new Date(selected.operation.timestamp).toLocaleString()}
        </dd>

        <dt>Direction</dt>
        <dd title={selected.operation.direction}>{selected.operation.direction}</dd>

        <dt>Envelope</dt>
        <dd title={selected.operation.type}>{selected.operation.type}</dd>

        <dt>Status</dt>
        <dd title={selected.operation.status}>{selected.operation.status}</dd>

        <dt>Payload</dt>
        <dd title={formatBytes(selected.operation.payloadBytes)}>
          {formatBytes(selected.operation.payloadBytes)}
        </dd>

        <dt>Duration</dt>
        <dd title={selected.operation.durationMs == null ? '—' : `${selected.operation.durationMs} ms`}>
          {selected.operation.durationMs == null ? '—' : `${selected.operation.durationMs} ms`}
        </dd>

        <dt>Correlation ID</dt>
        <dd title={selected.operation.correlationId || '—'}>
          {selected.operation.correlationId || '—'}
        </dd>

        <dt>Error</dt>
        <dd title={selected.operation.errorCode || '—'}>
          {selected.operation.errorCode || '—'}
        </dd>
      </dl>
    </aside>
  {/if}
</section>
