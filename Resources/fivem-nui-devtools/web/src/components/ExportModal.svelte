<script lang="ts">
  import { copyText, devtools, downloadJson } from '../state/devtools.svelte';

  async function handleCopy(): Promise<void> {
    const success = await copyText(devtools.exportJson);
    if (success) {
      devtools.exportNotice = '✔ Copied to clipboard again!';
      devtools.exportNoticeColor = '#45b878';
    } else {
      devtools.exportNotice = 'Copy failed. Please manually select and Ctrl+C below.';
      devtools.exportNoticeColor = '#e06060';
    }
  }

  function handleDownload(): void {
    downloadJson(devtools.exportJson);
  }
</script>

{#if devtools.exportModalOpen}
  <div class="export-modal" role="dialog" aria-modal="true" aria-label="Export session data">
    <header>
      <span>EXPORT SESSION DATA (JSON)</span>
      <button
        type="button"
        title="Close"
        onclick={() => (devtools.exportModalOpen = false)}
      >
        ×
      </button>
    </header>

    <div class="export-body">
      <p style="color: {devtools.exportNoticeColor}">{devtools.exportNotice}</p>
      <textarea
        class="export-textarea"
        spellcheck="false"
        value={devtools.exportJson}
        placeholder="Export data will appear here..."
        readonly
      ></textarea>
    </div>

    <div class="export-footer">
      <button type="button" onclick={handleCopy}>Copy to Clipboard</button>
      <button type="button" onclick={handleDownload}>Download File</button>
      <button type="button" onclick={() => (devtools.exportModalOpen = false)}>Close</button>
    </div>
  </div>
{/if}
