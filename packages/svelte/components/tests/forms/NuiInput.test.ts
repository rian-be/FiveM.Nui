import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, unmount, flushSync, type ComponentProps } from 'svelte';
import type { SvelteNuiClient } from '@fivem-nui/svelte';
import NuiInput from '../../src/components/forms/NuiInput.svelte';

type InputProps = ComponentProps<typeof NuiInput>;

describe('NuiInput', () => {
  let container: HTMLElement;
  let mountedApps: ReturnType<typeof mount>[] = [];

  function createMockClient() {
    return {
      send: vi.fn(),
      on: vi.fn().mockReturnValue(() => {})
    } as unknown as SvelteNuiClient;
  }

  function mountInput(props: InputProps = {}) {
    const target = document.createElement('div');
    container.appendChild(target);
    const inst = mount(NuiInput, {
      target,
      props
    });
    mountedApps.push(inst);
    flushSync();
    const input = target.querySelector<HTMLInputElement | HTMLTextAreaElement>('.nui-field__control')!;
    const label = target.querySelector<HTMLElement>('.nui-field__label');
    return { input, label, inst, target };
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

  it('renders standard text input with label and placeholder', () => {
    const { input, label } = mountInput({
      label: 'Username',
      placeholder: 'Enter character name',
      value: 'John'
    });

    expect(label?.textContent).toBe('Username');
    expect(input).toBeInstanceOf(HTMLInputElement);
    expect((input as HTMLInputElement).value).toBe('John');
    expect(input.placeholder).toBe('Enter character name');
  });

  it('renders textarea when type is set to textarea', () => {
    const { input } = mountInput({
      type: 'textarea',
      value: 'Multi-line biography'
    });

    expect(input).toBeInstanceOf(HTMLTextAreaElement);
    expect(input.tagName.toLowerCase()).toBe('textarea');
  });

  it('handles input events and triggers onInput and immediate onValueChange when debounce is empty', () => {
    const mockClient = createMockClient();

    const { input } = mountInput({
      onInput: 'input:typed',
      onValueChange: 'input:settled',
      client: mockClient
    });

    input.value = 'hello';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();

    expect(mockClient.send).toHaveBeenCalledWith('input:typed', { value: 'hello' });
    expect(mockClient.send).toHaveBeenCalledWith('input:settled', { value: 'hello' });
  });

  it('debounces onValueChange when debounce string is specified', () => {
    vi.useFakeTimers();
    try {
      const mockClient = createMockClient();

      const { input } = mountInput({
        onValueChange: 'input:debounced',
        debounce: '300ms',
        client: mockClient
      });

      input.value = 'a';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      flushSync();

      expect(mockClient.send).not.toHaveBeenCalled();

      input.value = 'ab';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      flushSync();

      vi.advanceTimersByTime(200);
      expect(mockClient.send).not.toHaveBeenCalled();

      vi.advanceTimersByTime(150);
      expect(mockClient.send).toHaveBeenCalledWith('input:debounced', { value: 'ab' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('flushes pending debounced value on blur', () => {
    vi.useFakeTimers();
    try {
      const mockClient = createMockClient();

      const { input } = mountInput({
        onValueChange: 'input:blur-flushed',
        onBlur: 'input:blurred',
        debounce: '500ms',
        client: mockClient
      });

      input.value = 'fast';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      flushSync();

      input.dispatchEvent(new Event('blur', { bubbles: true }));
      flushSync();

      expect(mockClient.send).toHaveBeenCalledWith('input:blur-flushed', { value: 'fast' });
      expect(mockClient.send).toHaveBeenCalledWith('input:blurred', { value: 'fast' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('dispatches onFocus event on focus', () => {
    const mockClient = createMockClient();

    const { input } = mountInput({
      value: 'focused-val',
      onFocus: 'input:focused',
      client: mockClient
    });

    input.dispatchEvent(new Event('focus', { bubbles: true }));
    flushSync();

    expect(mockClient.send).toHaveBeenCalledWith('input:focused', { value: 'focused-val' });
  });

  it('subscribes to client.on for twoWay data binding and applies valueProcessor', () => {
    let messageHandler: ((data: unknown) => void) | null = null;
    const mockClient = {
      send: vi.fn(),
      on: vi.fn((_event: string, cb: (data: unknown) => void) => {
        messageHandler = cb;
        return () => {};
      })
    } as unknown as SvelteNuiClient;

    const valueProcessor = vi.fn((d: unknown) => String(d).toUpperCase());

    const { input } = mountInput({
      twoWay: true,
      eventName: 'player:name:update',
      client: mockClient,
      valueProcessor
    });

    expect(mockClient.on).toHaveBeenCalledWith('player:name:update', expect.any(Function));

    messageHandler!('michael');
    flushSync();

    expect(valueProcessor).toHaveBeenCalledWith('michael');
    expect((input as HTMLInputElement).value).toBe('MICHAEL');
  });

  it('safely catches errors in safeSend when client.send rejects or throws', () => {
    const mockClient = {
      send: vi.fn().mockImplementation(() => {
        throw new Error('Sync send error');
      }),
      on: vi.fn().mockReturnValue(() => {})
    } as unknown as SvelteNuiClient;

    const { input } = mountInput({
      onInput: 'error:event',
      client: mockClient
    });

    input.value = 'test';
    expect(() => {
      input.dispatchEvent(new Event('input', { bubbles: true }));
      flushSync();
    }).not.toThrow();
  });
});
