import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, unmount, flushSync, type ComponentProps } from 'svelte';
import NuiCodeBlock from '../../src/components/data/NuiCodeBlock.svelte';

type CodeBlockProps = ComponentProps<typeof NuiCodeBlock>;

describe('NuiCodeBlock', () => {
  let container: HTMLElement;
  let mountedApps: ReturnType<typeof mount>[] = [];

  function mountCodeBlock(props: CodeBlockProps = {}) {
    const target = document.createElement('div');
    container.appendChild(target);
    const inst = mount(NuiCodeBlock, {
      target,
      props
    });
    mountedApps.push(inst);
    flushSync();
    const root = target.querySelector<HTMLElement>('.nui-code-block')!;
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
    vi.restoreAllMocks();
  });

  it('renders code snippet with default language class and copy button', () => {
    const { root } = mountCodeBlock({
      code: 'console.log("hello");',
      language: 'javascript'
    });

    expect(root).not.toBeNull();
    const codeEl = root.querySelector('code');
    expect(codeEl?.textContent).toBe('console.log("hello");');
    expect(codeEl?.classList.contains('language-javascript')).toBe(true);

    const copyBtn = root.querySelector<HTMLButtonElement>('.nui-code-block__copy');
    expect(copyBtn).not.toBeNull();
    expect(copyBtn?.textContent?.trim()).toBe('Copy');
  });

  it('displays title in header when provided', () => {
    const { root } = mountCodeBlock({
      title: 'index.ts',
      code: 'export default {};'
    });

    const titleEl = root.querySelector('.nui-code-block__title');
    expect(titleEl?.textContent).toBe('index.ts');
  });

  it('copies code to clipboard and updates button state and calls onCopy', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: writeTextMock
      }
    });

    const onCopy = vi.fn();
    const { root } = mountCodeBlock({
      code: 'const x = 1;',
      onCopy
    });

    const copyBtn = root.querySelector<HTMLButtonElement>('.nui-code-block__copy')!;
    copyBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await vi.waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith('const x = 1;');
      expect(onCopy).toHaveBeenCalledWith('const x = 1;');
      expect(copyBtn.textContent?.trim()).toBe('Copied!');
    });
  });

  it('handles clipboard failure and calls onCopyError', async () => {
    const writeTextMock = vi.fn().mockRejectedValue(new Error('Permission denied'));
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: writeTextMock
      }
    });

    const onCopyError = vi.fn();
    const { root } = mountCodeBlock({
      code: 'test code',
      onCopyError
    });

    const copyBtn = root.querySelector<HTMLButtonElement>('.nui-code-block__copy')!;
    copyBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await vi.waitFor(() => {
      expect(onCopyError).toHaveBeenCalledWith(expect.any(Error));
      expect(copyBtn.textContent?.trim()).toBe('Failed');
    });
  });

  it('hides copy button when showCopyButton is false', () => {
    const { root } = mountCodeBlock({
      showCopyButton: false,
      code: 'secret'
    });

    expect(root.querySelector('.nui-code-block__copy')).toBeNull();
  });
});
