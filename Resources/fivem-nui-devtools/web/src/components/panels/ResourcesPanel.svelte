<script lang="ts">
  import { devtools } from '../../state/devtools.svelte';
  import { resourceGroup } from '../../utils/format';

  const counts = $derived(devtools.resourceCounts);
  const visible = $derived(devtools.filteredResources);
  const lifecycle = $derived(devtools.sortedLifecycle);
  const sampledText = $derived(
    devtools.resourceInventory.timestamp
      ? `sampled ${new Date(devtools.resourceInventory.timestamp).toLocaleTimeString()}`
      : 'not sampled'
  );
</script>

<section class="panel resources-panel" class:active={devtools.activeTab === 'resources'}>
  <div class="resource-summary">
    <span><b>{counts.total}</b> total</span>
    <span class="started"><b>{counts.started}</b> started</span>
    <span class="transitioning"><b>{counts.transitioning}</b> transitioning</span>
    <span class="inactive"><b>{counts.inactive}</b> inactive</span>
    <span class="resource-updated">{sampledText}</span>
  </div>

  <div class="resource-tools">
    <input
      type="search"
      placeholder="Filter resources…"
      autocomplete="off"
      bind:value={devtools.resourceSearch}
      aria-label="Filter resource inventory"
    />
    <select
      bind:value={devtools.resourceFilter}
      aria-label="Filter resource state"
    >
      <option value="all">All states</option>
      <option value="started">Started</option>
      <option value="transitioning">Transitioning</option>
      <option value="inactive">Inactive</option>
    </select>
    <div style="display:flex;gap:4px">
      <button
        class="subtab-btn"
        class:active={devtools.activeResourceSubtab === 'inventory'}
        type="button"
        onclick={() => (devtools.activeResourceSubtab = 'inventory')}
      >
        Inventory
      </button>
      <button
        class="subtab-btn"
        class:active={devtools.activeResourceSubtab === 'lifecycle'}
        type="button"
        onclick={() => (devtools.activeResourceSubtab = 'lifecycle')}
      >
        Lifecycle ({lifecycle.length})
      </button>
    </div>
  </div>

  {#if devtools.activeResourceSubtab === 'inventory'}
    <div class="resource-rows">
      {#if visible.length === 0}
        <p style="padding:48px 12px;color:#6f747a;text-align:center;font-size:11px;margin:0;">
          {devtools.resourceInventory.resources?.length
            ? 'No resources match this filter.'
            : 'Resource inventory has not been received.'}
        </p>
      {:else}
        {#each visible as r (r.name)}
          <div class="resource-card">
            <div class="resource-header">
              <div class="resource-title">
                <span class="resource-name">{r.name}</span>
                {#if r.hasNui}
                  <span class="badge badge-nui">NUI</span>
                {/if}
                {#if r.isDiagnosticsProvider || devtools.providers[r.name]}
                  <span class="badge badge-provider">Provider</span>
                {/if}
              </div>
              <span class="resource-state {resourceGroup(r.state)}">{r.state}</span>
            </div>

            {#if r.version || r.author || r.description}
              <div class="resource-meta">
                {#if r.version}
                  <span>ver: <b>{r.version}</b></span>
                {/if}
                {#if r.author}
                  <span>by: <b>{r.author}</b></span>
                {/if}
                {#if r.description}
                  <span>{r.description}</span>
                {/if}
              </div>
            {/if}

            {#if r.dependencies && r.dependencies.length > 0}
              <div class="resource-deps">
                {#each r.dependencies as dep (dep)}
                  <span class="dep-tag">{dep}</span>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      {/if}
    </div>
  {:else}
    <div class="lifecycle-table-head">
      <span>Time</span>
      <span>Resource</span>
      <span>Event</span>
    </div>
    <div class="resource-rows">
      {#if lifecycle.length === 0}
        <p style="padding:48px 12px;color:#6f747a;text-align:center;font-size:11px;margin:0;">
          No lifecycle events observed yet.
        </p>
      {:else}
        {#each lifecycle as entry (entry.timestamp + entry.resource + entry.state)}
          <div class="lifecycle-row">
            <span class="lifecycle-time">{new Date(entry.timestamp).toLocaleTimeString()}</span>
            <span class="lifecycle-resource">{entry.resource}</span>
            <span class="lifecycle-state {entry.state}">{entry.state}</span>
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</section>
