<script lang="ts">
  import { ALL_PROVIDERS, devtools } from '../state/devtools.svelte';
  import type { Tab } from '../types';

  const tabs: Array<{ id: Tab; label: string; count?: number }> = $derived([
    { id: 'overview', label: 'Overview' },
    { id: 'details', label: 'Metrics' },
    { id: 'timeline', label: 'Timeline', count: devtools.allOperations.length },
    { id: 'resources', label: 'Resources', count: devtools.resourceInventory.resources?.length ?? 0 }
  ]);
</script>

<div class="toolbar">
  <label>
    Provider
    <select
      bind:value={devtools.activeSource}
      aria-label="Diagnostics provider selector"
    >
      <option value={ALL_PROVIDERS}>
        All providers ({devtools.providerNames.length})
      </option>
      {#each devtools.providerNames as name (name)}
        <option value={name}>{name}</option>
      {/each}
    </select>
  </label>

  <div class="tabs" role="tablist">
    {#each tabs as tab (tab.id)}
      <button
        class="tab"
        class:active={devtools.activeTab === tab.id}
        data-tab={tab.id}
        type="button"
        role="tab"
        aria-selected={devtools.activeTab === tab.id}
        onclick={() => (devtools.activeTab = tab.id)}
      >
        {tab.label}
        {#if tab.count !== undefined}
          <b>{tab.count}</b>
        {/if}
      </button>
    {/each}
  </div>

  <span class="sample-age">{devtools.sampleAgeText}</span>
</div>
