<script lang="ts">
  import { devtools } from '../state/devtools.svelte';

  const logoPath =
    typeof (window as unknown as { GetParentResourceName?: () => string }).GetParentResourceName ===
    'function'
      ? 'logo.png?v=1.6.4'
      : '/logo.png';
</script>

<header class="header">
  <div class="identity">
    <img class="product-mark" src={logoPath} alt="FiveM.Nui Logo" />
    <strong>FiveM.Nui</strong><i>/</i><span>Diagnostics</span>
  </div>

  <div class="header-actions">
    {#if devtools.alertsList.length > 0}
      <button
        type="button"
        class="alerts-badge"
        class:has-errors={devtools.hasAlertErrors}
        onclick={() => (devtools.alertsOpen = !devtools.alertsOpen)}
        aria-label="Toggle alerts banner"
      >
        <span>{devtools.alertsList.length}</span> alerts
      </button>
    {/if}

    <div class="header-status">
      <span class="pulse"></span>
      <span>{devtools.status}</span>
    </div>
  </div>
</header>
