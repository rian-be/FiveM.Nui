<script lang="ts">
  import { ALL_PROVIDERS, devtools } from '../../state/devtools.svelte';

  const counters = $derived.by(() => {
    const raw = devtools.selectedState?.latest?.counters ?? {};
    return Object.entries(raw).sort((a, b) => b[1] - a[1]);
  });

  const timings = $derived.by(() => {
    const raw = devtools.selectedState?.latest?.timings ?? {};
    return Object.entries(raw).sort((a, b) => b[1] - a[1]);
  });

  const sourceName = $derived(
    devtools.activeSource === ALL_PROVIDERS ? 'all' : devtools.activeSource
  );
</script>

<section class="panel details-panel" class:active={devtools.activeTab === 'details'}>
  <div class="detail-grid">
    <article>
      <header>
        <span>COUNTERS</span>
        <b>{counters.length} entries</b>
      </header>
      <div class="metric-head">
        <span>Resource</span>
        <span>Metric</span>
        <span>Value</span>
      </div>
      <div class="data-list">
        {#if counters.length === 0}
          <p>No data recorded.</p>
        {:else}
          {#each counters as [name, value] (name)}
            <div class="metric-row">
              <small>{sourceName}</small>
              <span title={name}>{name}</span>
              <b>{value.toLocaleString()}</b>
            </div>
          {/each}
        {/if}
      </div>
    </article>

    <article>
      <header>
        <span>TIMINGS</span>
        <b>{timings.length} entries</b>
      </header>
      <div class="metric-head">
        <span>Resource</span>
        <span>Metric</span>
        <span>Value</span>
      </div>
      <div class="data-list">
        {#if timings.length === 0}
          <p>No data recorded.</p>
        {:else}
          {#each timings as [name, value] (name)}
            <div class="metric-row">
              <small>{sourceName}</small>
              <span title={name}>{name}</span>
              <b>{value.toLocaleString()} ms</b>
            </div>
          {/each}
        {/if}
      </div>
    </article>
  </div>
</section>
