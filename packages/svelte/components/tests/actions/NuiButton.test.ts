import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, unmount, flushSync, createRawSnippet, type ComponentProps } from 'svelte';
import type { SvelteNuiClient } from '@fivem-nui/svelte';
import NuiButton from '../../src/components/actions/NuiButton.svelte';

type ButtonProps = ComponentProps<typeof NuiButton>;

describe('NuiButton', () => {
  let container: HTMLElement;
  let mountedApps: ReturnType<typeof mount>[] = [];

  function createMockClient(overrides: Partial<{
    send: ReturnType<typeof vi.fn>;
    sendAndWait: ReturnType<typeof vi.fn>;
  }> = {}) {
    const client = {
      send: vi.fn(),
      sendAndWait: vi.fn().mockResolvedValue(undefined),
      ...overrides
    };
    return client as typeof client & SvelteNuiClient;
  }

  function mountButton(props: ButtonProps = {}) {
    const target = document.createElement('div');
    container.appendChild(target);
    const inst = mount(NuiButton, {
      target,
      props
    });
    mountedApps.push(inst);
    flushSync();
    const button = target.querySelector<HTMLButtonElement>('button')!;
    return { button, inst, target };
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

  it('renders with default props (variant=primary, size=md, type=button)', () => {
    const { button } = mountButton();

    expect(button).not.toBeNull();
    expect(button.type).toBe('button');
    expect(button.classList.contains('nui-btn--primary')).toBe(true);
    expect(button.classList.contains('nui-btn--md')).toBe(true);
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-busy')).toBe('false');
  });

  it('renders different variants and sizes', () => {
    const { button } = mountButton({
      variant: 'danger',
      size: 'lg'
    });

    expect(button.classList.contains('nui-btn--danger')).toBe(true);
    expect(button.classList.contains('nui-btn--lg')).toBe(true);
  });

  it('renders children content via snippet', () => {
    const children = createRawSnippet(() => ({
      render: () => '<span id="btn-text">Click Me</span>'
    }));

    const { button } = mountButton({ children });
    expect(button.querySelector('#btn-text')?.textContent).toBe('Click Me');
  });

  it('dispatches NUI event on click via client.sendAndWait', async () => {
    const mockClient = createMockClient({
      sendAndWait: vi.fn().mockResolvedValue({ status: 'ok' })
    });
    const onSuccessCallback = vi.fn();

    const { button } = mountButton({
      eventName: 'player:teleport',
      payload: { x: 10, y: 20 },
      client: mockClient,
      onSuccessCallback
    });

    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await vi.waitFor(() => {
      expect(mockClient.sendAndWait).toHaveBeenCalledWith('player:teleport', { x: 10, y: 20 });
      expect(onSuccessCallback).toHaveBeenCalledWith({ status: 'ok' });
    });
  });

  it('falls back to client.send if sendAndWait is not present on client', async () => {
    const mockClient = {
      send: vi.fn().mockResolvedValue(undefined)
    } as unknown as SvelteNuiClient;

    const { button } = mountButton({
      eventName: 'simple:event',
      client: mockClient
    });

    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await vi.waitFor(() => {
      expect(mockClient.send).toHaveBeenCalledWith('simple:event', undefined);
    });
  });

  it('triggers onSuccess event when operation succeeds', async () => {
    const mockClient = createMockClient();

    const { button } = mountButton({
      eventName: 'action:do',
      onSuccess: 'action:done',
      onSuccessPayload: { done: true },
      client: mockClient
    });

    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await vi.waitFor(() => {
      expect(mockClient.sendAndWait).toHaveBeenCalledWith('action:do', undefined);
      expect(mockClient.sendAndWait).toHaveBeenCalledWith('action:done', { done: true });
    });
  });

  it('handles client failure envelope { success: false, error: ... } and calls onFailure/onError', async () => {
    const mockClient = createMockClient({
      sendAndWait: vi.fn().mockImplementation((name: string) => {
        if (name === 'buy:item') {
          return Promise.resolve({ success: false, error: { message: 'Not enough cash' } });
        }
        return Promise.resolve();
      })
    });
    const onFailure = vi.fn();

    const { button } = mountButton({
      eventName: 'buy:item',
      onError: 'buy:failed',
      onErrorPayload: { item: 'bandage' },
      client: mockClient,
      onFailure
    });

    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await vi.waitFor(() => {
      expect(onFailure).toHaveBeenCalledWith(expect.any(Error));
      expect(mockClient.sendAndWait).toHaveBeenCalledWith('buy:failed', {
        item: 'bandage',
        error: 'Not enough cash'
      });
    });
  });

  it('handles thrown error and calls onFailure with onError string payload fallback', async () => {
    const mockClient = createMockClient({
      sendAndWait: vi.fn().mockRejectedValue(new Error('Network timeout'))
    });
    const onFailure = vi.fn();

    const { button } = mountButton({
      eventName: 'sync:data',
      onError: 'sync:error',
      onErrorPayload: 'scalar-payload',
      client: mockClient,
      onFailure
    });

    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await vi.waitFor(() => {
      expect(onFailure).toHaveBeenCalledWith(expect.any(Error));
      expect(mockClient.sendAndWait).toHaveBeenCalledWith('sync:error', {
        payload: 'scalar-payload',
        error: 'Network timeout'
      });
    });
  });

  it('executes local onclick hook and cancels subsequent NUI event if onclick returns false', async () => {
    const mockClient = createMockClient();
    const onclick = vi.fn().mockReturnValue(false);

    const { button } = mountButton({
      eventName: 'should:not:fire',
      client: mockClient,
      onclick
    });

    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    flushSync();
    await Promise.resolve();

    expect(onclick).toHaveBeenCalled();
    expect(mockClient.sendAndWait).not.toHaveBeenCalled();
  });

  it('cancels subsequent NUI event if onclick calls event.preventDefault()', async () => {
    const mockClient = createMockClient();
    const onclick = vi.fn((e: MouseEvent) => {
      e.preventDefault();
    });

    const { button } = mountButton({
      eventName: 'should:not:fire',
      client: mockClient,
      onclick
    });

    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    flushSync();
    await Promise.resolve();

    expect(onclick).toHaveBeenCalled();
    expect(mockClient.sendAndWait).not.toHaveBeenCalled();
  });

  it('respects condition predicate and disables interaction', () => {
    const { button } = mountButton({
      eventName: 'test:event',
      condition: () => false
    });

    expect(button.disabled).toBe(true);
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    flushSync();
    expect(button.classList.contains('nui-btn--primary')).toBe(true);
  });

  it('respects disabledWhen boolean and function', () => {
    const { button: btn1 } = mountButton({
      disabledWhen: true
    });
    expect(btn1.disabled).toBe(true);

    const { button: btn2 } = mountButton({
      disabledWhen: () => true
    });
    expect(btn2.disabled).toBe(true);

    const { button: btn3 } = mountButton({
      disabledWhen: () => false
    });
    expect(btn3.disabled).toBe(false);
  });

  it('shows loading spinner when loading is true', () => {
    const { button } = mountButton({
      loading: true
    });

    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.querySelector('.nui-btn__spinner')).not.toBeNull();
  });

  it('handles keepLoadingOnSuccess when main operation finishes', async () => {
    let resolveSend: () => void = () => {};
    const pendingPromise = new Promise<void>((resolve) => {
      resolveSend = resolve;
    });

    const mockClient = createMockClient({
      sendAndWait: vi.fn().mockImplementation(() => pendingPromise)
    });

    const { button } = mountButton({
      eventName: 'keep:loading',
      client: mockClient,
      keepLoadingOnSuccess: true
    });

    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    flushSync();

    expect(button.getAttribute('aria-busy')).toBe('true');

    resolveSend();
    await Promise.resolve();
    flushSync();

    expect(button.getAttribute('aria-busy')).toBe('true');
  });

  it('does nothing on click if button has no eventName and no onclick', () => {
    const { button } = mountButton({});
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    flushSync();
    expect(button.getAttribute('aria-busy')).toBe('false');
  });
});
