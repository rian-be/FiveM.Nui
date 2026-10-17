<!--
  @component NuiRichText
  Renders formatted text or sanitized HTML content.

  Security Policy & Sanitization:
  - Default Mode (`parseHtml = false`):
    Safe by default. Content is rendered via Svelte's native text binding inside `<pre>`,
    preventing any HTML or script execution.
  - HTML Mode (`parseHtml = true`):
    Enables HTML parsing. Applies an allowlist of safe formatting tags/attributes, protocol
    filtering on links (http, https, mailto, safe relative URLs), unwraps benign wrapper tags,
    and drops dangerous elements (script, style, iframe, etc.).
  - Custom Sanitizer:
    For untrusted or user-submitted content (e.g. player chat, server announcements, external API data),
    pass an enterprise-grade sanitizer (e.g. `DOMPurify.sanitize`) via the `sanitizer` prop.
    The provided sanitizer function must return an XSS-safe HTML string.
-->
<script lang="ts">
  interface Props {
    /** Text or HTML content to display. */
    content: string;
    /** Whether to parse and render content as HTML. Defaults to false. */
    parseHtml?: boolean;
    /**
     * Optional custom sanitizer function (e.g. DOMPurify.sanitize).
     * Must return an XSS-safe HTML string.
     */
    sanitizer?: ((dirty: string) => string) | null;
    /** Optional additional CSS class for root container. */
    className?: string;
  }

  let {
    content,
    parseHtml = false,
    sanitizer = null,
    className = ''
  }: Props = $props();

  const ALLOWED_TAGS = new Set([
    'a', 'b', 'blockquote', 'br', 'code', 'dd', 'del', 'div', 'dl', 'dt',
    'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'ins', 'kbd',
    'li', 'mark', 'ol', 'p', 'pre', 's', 'small', 'span', 'strike',
    'strong', 'sub', 'sup', 'time', 'u', 'ul'
  ]);

  const DROP_CONTENT_TAGS = new Set([
    'script', 'style', 'iframe', 'noembed', 'noframes', 'noscript',
    'object', 'embed', 'template', 'svg', 'canvas', 'audio', 'video',
    'input', 'textarea', 'select', 'button', 'form'
  ]);

  const ALLOWED_ATTRS: Record<string, Set<string>> = {
    a: new Set(['href', 'title', 'target', 'rel']),
    time: new Set(['datetime']),
    '*': new Set(['class', 'title', 'aria-label', 'aria-hidden'])
  };

  // Strict ISO-8601 date/time (e.g. 2026-10-17, 2026-10-17T14:30:00Z)
  const ISO_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Validates whether a URL uses a safe protocol (http, https, mailto, or relative).
   * Rejects control characters, protocol-relative URLs (//...), and dangerous schemes.
   */
  function isSafeUrl(urlStr: string): boolean {
    const value = urlStr.trim();

    // Reject control characters rather than trying to normalize them
    if (/[\u0000-\u001F\u007F-\u009F]/.test(value)) {
      return false;
    }

    // Allow ordinary relative URLs, but reject protocol-relative URLs (//...)
    if (value.startsWith('/') && !value.startsWith('//')) {
      return true;
    }

    // Allow anchors and query parameters
    if (value.startsWith('#') || value.startsWith('?')) {
      return true;
    }

    try {
      const parsed = new URL(value);
      return (
        parsed.protocol === 'https:' ||
        parsed.protocol === 'http:' ||
        parsed.protocol === 'mailto:'
      );
    } catch {
      return false;
    }
  }

  function cleanNode(node: Node): void {
    const children = Array.from(node.childNodes);

    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        const tagName = el.tagName.toLowerCase();

        // Completely discard dangerous elements and their subtrees
        if (DROP_CONTENT_TAGS.has(tagName)) {
          node.removeChild(child);
          continue;
        }

        // Unwrap benign wrapper elements not in allowlist, preserving their sanitized text/children
        if (!ALLOWED_TAGS.has(tagName)) {
          cleanNode(child);
          while (child.firstChild) {
            node.insertBefore(child.firstChild, child);
          }
          node.removeChild(child);
          continue;
        }

        const attrs = Array.from(el.attributes);
        for (const attr of attrs) {
          const attrName = attr.name.toLowerCase();
          const allowedForTag = ALLOWED_ATTRS[tagName];
          const allowedGlobal = ALLOWED_ATTRS['*'];
          const isAllowed =
            (allowedForTag && allowedForTag.has(attrName)) ||
            (allowedGlobal && allowedGlobal.has(attrName));

          if (!isAllowed || attrName.startsWith('on')) {
            el.removeAttribute(attr.name);
            continue;
          }

          if (attrName === 'href' && !isSafeUrl(attr.value)) {
            el.removeAttribute(attr.name);
            continue;
          }

          if (attrName === 'datetime' && !ISO_DATETIME_REGEX.test(attr.value.trim())) {
            el.removeAttribute(attr.name);
            continue;
          }
        }

        if (tagName === 'a') {
          el.setAttribute('rel', 'noopener noreferrer');
        }

        cleanNode(child);
      } else if (
        child.nodeType !== Node.TEXT_NODE &&
        child.nodeType !== Node.COMMENT_NODE
      ) {
        node.removeChild(child);
      }
    }
  }

  function defaultSanitize(dirtyHtml: string): string {
    if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
      return escapeHtml(dirtyHtml);
    }
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(dirtyHtml, 'text/html');
      cleanNode(doc.body);
      return doc.body.innerHTML;
    } catch {
      return escapeHtml(dirtyHtml);
    }
  }

  const safeContent = $derived.by(() => {
    if (!content) return '';
    if (!parseHtml) return content;

    try {
      return sanitizer ? sanitizer(content) : defaultSanitize(content);
    } catch (error) {
      console.error('[fivem-nui-components] Failed to sanitize rich text:', error);
      return escapeHtml(content);
    }
  });
</script>

<div
  class="nui-rich-text {className}"
  class:nui-rich-text--html={parseHtml}
>
  {#if parseHtml}
    {@html safeContent}
  {:else}
    <pre class="nui-rich-text__pre">{content}</pre>
  {/if}
</div>

<style>
  .nui-rich-text {
    font-family: inherit;
    line-height: 1.6;
    color: var(--nui-fg, #fafafa);
  }

  .nui-rich-text__pre {
    background: var(--nui-surface-alt, #101012);
    border: 1px solid var(--nui-border, #27272a);
    border-radius: var(--nui-radius, 0.375rem);
    padding: 1rem;
    overflow-x: auto;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 0.875rem;
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .nui-rich-text :global(pre),
  .nui-rich-text :global(code) {
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 0.875rem;
  }

  .nui-rich-text :global(p) {
    margin: 0 0 1rem 0;
  }

  .nui-rich-text :global(ul),
  .nui-rich-text :global(ol) {
    margin: 0 0 1rem 0;
    padding-left: 1.5rem;
  }

  .nui-rich-text :global(li) {
    margin: 0 0 0.25rem 0;
  }

  .nui-rich-text :global(h1),
  .nui-rich-text :global(h2),
  .nui-rich-text :global(h3),
  .nui-rich-text :global(h4),
  .nui-rich-text :global(h5),
  .nui-rich-text :global(h6) {
    margin: 1rem 0 0.5rem 0;
    font-weight: 600;
  }

  .nui-rich-text :global(h1) { font-size: 1.5rem; }
  .nui-rich-text :global(h2) { font-size: 1.25rem; }
  .nui-rich-text :global(h3) { font-size: 1.125rem; }
  .nui-rich-text :global(h4) { font-size: 1rem; }
</style>
