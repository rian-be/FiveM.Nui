import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, unmount, flushSync, type ComponentProps } from 'svelte';
import NuiRichText from '../../src/components/data/NuiRichText.svelte';

type RichTextProps = ComponentProps<typeof NuiRichText>;

describe('NuiRichText', () => {
  let container: HTMLElement;
  let mountedApps: ReturnType<typeof mount>[] = [];

  function mountRichText(props: RichTextProps) {
    const target = document.createElement('div');
    container.appendChild(target);
    const inst = mount(NuiRichText, {
      target,
      props
    });
    mountedApps.push(inst);
    flushSync();
    const root = target.firstElementChild as HTMLElement;
    return { root, inst, target };
  }

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    while (mountedApps.length > 0) {
      unmount(mountedApps.pop()!);
    }
    container.remove();
    document.body.innerHTML = '';
  });

  it('renders safe plain text inside pre by default without executing HTML', () => {
    const { root } = mountRichText({
      content: 'Line 1\n<script>alert("xss")</script>\nLine 2'
    });

    expect(root.tagName.toLowerCase()).toBe('div');
    expect(root.classList.contains('nui-rich-text')).toBe(true);
    const pre = root.querySelector('.nui-rich-text__pre');
    expect(pre).not.toBeNull();
    expect(pre?.textContent).toContain('<script>alert("xss")</script>');
    expect(root.querySelector('script')).toBeNull();
  });

  it('parses safe HTML tags and strips forbidden tags and attributes when parseHtml is true', () => {
    const { root } = mountRichText({
      parseHtml: true,
      content: '<p>Hello <b>World</b>!</p><script>evil()</script><a href="https://example.com" onclick="steal()">Link</a>'
    });

    expect(root.tagName.toLowerCase()).toBe('div');
    expect(root.querySelector('p')).not.toBeNull();
    expect(root.querySelector('b')?.textContent).toBe('World');
    expect(root.querySelector('script')).toBeNull();

    const link = root.querySelector('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('https://example.com');
    expect(link?.getAttribute('onclick')).toBeNull();
  });

  it('uses custom sanitizer when provided', () => {
    const customSanitizer = vi.fn().mockReturnValue('<span>Sanitized Custom Content</span>');

    const { root } = mountRichText({
      parseHtml: true,
      content: 'raw content',
      sanitizer: customSanitizer
    });

    expect(customSanitizer).toHaveBeenCalledWith('raw content');
    expect(root.textContent).toBe('Sanitized Custom Content');
  });
});
