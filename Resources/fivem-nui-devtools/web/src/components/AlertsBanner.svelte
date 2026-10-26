<script lang="ts">
  import { devtools } from '../state/devtools.svelte';
</script>

{#if devtools.alertsOpen && devtools.alertsList.length > 0}
  <div class="alerts-banner" role="region" aria-label="System diagnostic alerts">
    {#each devtools.alertsList.slice(0, 3) as alert (alert.timestamp + alert.code)}
      <div class="alert-row {alert.severity}">
        <div>
          <span class="alert-time">{new Date(alert.timestamp).toLocaleTimeString()}</span>
          <span>[{alert.resource}] {alert.message}</span>
        </div>
      </div>
    {/each}
  </div>
{/if}
