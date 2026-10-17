<!--
  @component NuiCodeBlock
  Code snippet block with optional title, language syntax classes, and clipboard copy button.
-->
<script module lang="ts">
  export type NuiCodeLanguage =
    | 'csharp'
    | 'javascript'
    | 'typescript'
    | 'lua'
    | 'sql'
    | 'json'
    | 'xml'
    | 'bash'
    | 'css'
    | 'markdown'
    | (string & {});
</script>

<script lang="ts">
  import { onDestroy } from 'svelte';

  interface Props {
    /** Code snippet to display. */
    code?: string;
    /**
     * Programming language for syntax highlighting classes.
     * Integrates with external highlighters like highlight.js or Prism.
     * @defaultValue 'csharp'
     */
    language?: NuiCodeLanguage;
    /** Optional title or filename displayed in the header. */
    title?: string;
    /**
     * Whether to show the copy-to-clipboard button.
     * @defaultValue true
     */
    showCopyButton?: boolean;
    /**
     * Rounded container borders.
     * @defaultValue true
     */
    rounded?: boolean;
    /**
     * Label for copy button in idle state.
     * @defaultValue 'Copy'
     */
    copyLabel?: string;
    /**
     * Label for copy button in copied state.
     * @defaultValue 'Copied!'
     */
    copiedLabel?: string;
    /**
     * Label for copy button in error state.
     * @defaultValue 'Failed'
     */
    errorLabel?: string;
    /** Callback executed on successful clipboard copy. */
    onCopy?: (code: string) => void;
    /** Callback executed when clipboard copy fails. */
    onCopyError?: (error: unknown) => void;
  }

  let {
    code = '',
    language = 'csharp',
    title,
    showCopyButton = true,
    rounded = true,
    copyLabel = 'Copy',
    copiedLabel = 'Copied!',
    errorLabel = 'Failed',
    onCopy,
    onCopyError
  }: Props = $props();

  let copying = $state(false);
  let copied = $state(false);
  let copyFailed = $state(false);
  let copyTimeout: ReturnType<typeof setTimeout> | undefined;

  onDestroy(() => {
    if (copyTimeout !== undefined) {
      clearTimeout(copyTimeout);
      copyTimeout = undefined;
    }
  });

  async function copyToClipboard() {
    if (copying) return;

    if (copyTimeout !== undefined) {
      clearTimeout(copyTimeout);
      copyTimeout = undefined;
    }

    copying = true;
    copied = false;
    copyFailed = false;

    let writeSuccess = false;
    let writeError: unknown;

    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
        throw new Error('Clipboard API not available');
      }
      await navigator.clipboard.writeText(code);
      writeSuccess = true;
    } catch (e) {
      writeError = e;
      console.warn('[fivem-nui-components] Clipboard copy failed:', e);
    }

    copying = false;

    if (writeSuccess) {
      copied = true;
      try {
        onCopy?.(code);
      } catch (cbErr) {
        console.error('[fivem-nui-components] onCopy callback error:', cbErr);
      }
    } else {
      copyFailed = true;
      try {
        onCopyError?.(writeError);
      } catch (cbErr) {
        console.error('[fivem-nui-components] onCopyError callback error:', cbErr);
      }
    }

    copyTimeout = setTimeout(() => {
      copied = false;
      copyFailed = false;
      copyTimeout = undefined;
    }, 2000);
  }
</script>

<div class="nui-code-block" class:nui-code-block--rounded={rounded}>
  {#if title || showCopyButton}
    <div class="nui-code-block__header">
      {#if title}<span class="nui-code-block__title">{title}</span>{/if}
      {#if showCopyButton}
        <button
          type="button"
          class="nui-code-block__copy"
          class:nui-code-block__copy--copied={copied}
          class:nui-code-block__copy--error={copyFailed}
          disabled={copying}
          onclick={copyToClipboard}
          aria-label={copied ? copiedLabel : copyFailed ? errorLabel : copyLabel}
        >
          <span aria-live="polite" aria-atomic="true">
            {copied ? copiedLabel : copyFailed ? errorLabel : copyLabel}
          </span>
        </button>
      {/if}
    </div>
  {/if}

  <pre class="nui-code-block__pre"><code class="language-{language}">{code}</code></pre>
</div>

<style>
  .nui-code-block {
    width: 100%;
    font-family: 'Consolas', 'Monaco', monospace;
  }

  .nui-code-block__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 1rem;
    background: var(--nui-surface-alt, #101012);
    border: 1px solid var(--nui-border, #27272a);
    border-bottom: none;
  }

  .nui-code-block__title {
    font-size: 0.8125rem;
    color: var(--nui-fg-secondary, #8b8b99);
    font-weight: 500;
  }

  .nui-code-block__copy {
    background: transparent;
    border: 1px solid var(--nui-border, #3f3f46);
    border-radius: var(--nui-radius, 0.25rem);
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    color: var(--nui-fg, #fafafa);
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }

  .nui-code-block__copy:hover:not(:disabled) {
    background: var(--nui-hover, rgb(255 255 255 / 0.06));
  }

  .nui-code-block__copy:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .nui-code-block__copy:focus-visible {
    outline: 2px solid var(--nui-primary, #3b82f6);
    outline-offset: 2px;
  }

  .nui-code-block__copy--copied {
    border-color: var(--nui-success, #22c55e);
    color: var(--nui-success, #22c55e);
  }

  .nui-code-block__copy--error {
    border-color: var(--nui-danger, #ef4444);
    color: var(--nui-danger, #ef4444);
  }

  .nui-code-block__pre {
    margin: 0;
    padding: 1rem;
    background: var(--nui-surface, #18181b);
    border: 1px solid var(--nui-border, #27272a);
    overflow-x: auto;
    color: var(--nui-fg, #fafafa);
  }

  .nui-code-block--rounded .nui-code-block__header {
    border-radius: var(--nui-radius, 0.5rem) var(--nui-radius, 0.5rem) 0 0;
  }

  .nui-code-block--rounded .nui-code-block__pre {
    border-radius: var(--nui-radius, 0.5rem);
  }

  .nui-code-block--rounded .nui-code-block__header + .nui-code-block__pre {
    border-radius: 0 0 var(--nui-radius, 0.5rem) var(--nui-radius, 0.5rem);
  }

  .nui-code-block__pre code {
    font-size: 0.8125rem;
    line-height: 1.5;
  }

  /* Scoped syntax highlighting tokens (when external highlighter is applied) */
  .nui-code-block__pre :global(.string) { color: #facc15; }
  .nui-code-block__pre :global(.keyword) { color: #60a5fa; font-weight: 600; }
  .nui-code-block__pre :global(.function) { color: #a7f3d0; }
  .nui-code-block__pre :global(.comment) { color: #6b7280; opacity: 0.8; font-style: italic; }
  .nui-code-block__pre :global(.number) { color: #f472b6; }
</style>
