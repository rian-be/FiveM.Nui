<script lang="ts">
  import { devtools } from '../state/devtools.svelte';

  const shouldShow = $derived(!devtools.hasActiveData && devtools.activeTab !== 'resources');
</script>

{#if shouldShow}
  <div class="waiting" role="status">
    <strong>WAITING FOR A PROVIDER</strong>
    <span>Start a resource that emits <code>fivem-nui:diagnostics</code>.</span>
  </div>
{/if}
