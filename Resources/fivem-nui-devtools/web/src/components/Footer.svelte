<script lang="ts">
  import { devtools } from '../state/devtools.svelte';

  const modeHint = $derived(
    devtools.visibility.interactive
      ? 'Esc close  ·  P pause  ·  C clear  ·  M compact'
      : 'Run /nui_devtools_focus to interact'
  );
</script>

<footer>
  <div>
    <button type="button" onclick={() => devtools.togglePause()}>
      {devtools.paused ? 'Resume' : 'Pause'}
    </button>
    <button type="button" onclick={() => devtools.clearHistory()}>Clear</button>
    <button type="button" onclick={() => devtools.toggleCompact()}>
      {devtools.compact ? 'Expand' : 'Compact'}
    </button>
    <button
      type="button"
      class="btn-record"
      class:recording={devtools.sessionState.isRecording}
      onclick={() => devtools.toggleRecord()}
    >
      {#if devtools.sessionState.isRecording}
        ■ Stop ({devtools.sessionState.frameCount})
      {:else}
        ● Record
      {/if}
    </button>
    <button
      type="button"
      disabled={devtools.sessionState.isRecording}
      style={devtools.exportBtnColor ? `color: ${devtools.exportBtnColor}` : ''}
      onclick={() => devtools.requestExport()}
    >
      {devtools.exportBtnText}
    </button>
  </div>

  <span>{modeHint}</span>

  <button class="close" type="button" onclick={() => devtools.close()}>Close</button>
</footer>
