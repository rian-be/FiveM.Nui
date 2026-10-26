import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, unmount, flushSync, type ComponentProps } from 'svelte';
import type { SvelteNuiClient } from '@fivem-nui/svelte';
import NuiCheckbox from '../../src/components/forms/NuiCheckbox.svelte';

type CheckboxProps = ComponentProps<typeof NuiCheckbox>;

describe('NuiCheckbox', () => {
  let container: HTMLElement;
  let mountedApps: ReturnType<typeof mount>[] = [];

  function createMockClient() {
    return {
      send: vi.fn(),
      sendAndWait: vi.fn().mockResolvedValue(undefined)
    } as unknown as SvelteNuiClient;
  }

  function mountCheckbox(props: CheckboxProps = {}) {
    const target = document.createElement('div');
    container.appendChild(target);
    const inst = mount(NuiCheckbox, {
      target,
      props
    });
    mountedApps.push(inst);
    flushSync();
    const input = target.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    const label = target.querySelector<HTMLLabelElement>('label')!;
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

  it('renders with default props unchecked and enabled', () => {
    const { input, label } = mountCheckbox();

    expect(input).not.toBeNull();
    expect(input.checked).toBe(false);
    expect(input.disabled).toBe(false);
    expect(label.classList.contains('is-disabled')).toBe(false);
    expect(input.getAttribute('aria-label')).toBe('Checkbox');
  });

  it('renders label and description text and ties ids properly', () => {
    const { input, label, target } = mountCheckbox({
      id: 'agree-terms',
      label: 'I accept terms',
      description: 'You must read carefully'
    });

    expect(input.id).toBe('agree-terms');
    expect(label.getAttribute('for')).toBe('agree-terms');
    expect(label.textContent).toContain('I accept terms');
    expect(label.textContent).toContain('You must read carefully');
    expect(input.getAttribute('aria-describedby')).toBe('agree-terms-desc');
    expect(target.querySelector('#agree-terms-desc')).not.toBeNull();
  });

  it('toggles checked state and invokes onChange and dispatches eventName', () => {
    const mockClient = createMockClient();
    const onChange = vi.fn();

    const { input } = mountCheckbox({
      eventName: 'settings:toggle',
      client: mockClient,
      onChange
    });

    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();

    expect(onChange).toHaveBeenCalledWith(true);
    expect(mockClient.send).toHaveBeenCalledWith('settings:toggle', { value: true });

    input.checked = false;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();

    expect(onChange).toHaveBeenCalledWith(false);
    expect(mockClient.send).toHaveBeenCalledWith('settings:toggle', { value: false });
  });

  it('dispatches specific onCheck and onUncheck events when provided', () => {
    const mockClient = createMockClient();

    const { input } = mountCheckbox({
      onCheck: 'feature:enabled',
      onUncheck: 'feature:disabled',
      client: mockClient
    });

    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();
    expect(mockClient.send).toHaveBeenCalledWith('feature:enabled', { value: true });

    input.checked = false;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();
    expect(mockClient.send).toHaveBeenCalledWith('feature:disabled', { value: false });
  });

  it('sets indeterminate state on input element via effect', () => {
    const { input } = mountCheckbox({
      indeterminate: true
    });

    expect(input.indeterminate).toBe(true);
  });

  it('resets indeterminate on user interaction', () => {
    const { input } = mountCheckbox({
      indeterminate: true
    });

    expect(input.indeterminate).toBe(true);

    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();

    expect(input.indeterminate).toBe(false);
  });

  it('does not dispatch events or fire onChange when disabled', () => {
    const mockClient = createMockClient();
    const onChange = vi.fn();

    const { input, label } = mountCheckbox({
      disabled: true,
      eventName: 'disabled:event',
      client: mockClient,
      onChange
    });

    expect(input.disabled).toBe(true);
    expect(label.classList.contains('is-disabled')).toBe(true);

    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();

    expect(onChange).not.toHaveBeenCalled();
    expect(mockClient.send).not.toHaveBeenCalled();
  });
});
