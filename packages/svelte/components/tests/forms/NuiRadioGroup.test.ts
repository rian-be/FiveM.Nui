import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, unmount, flushSync, type ComponentProps } from 'svelte';
import NuiRadioGroup from '../../src/components/forms/NuiRadioGroup.svelte';

type NuiRadioOption = NonNullable<ComponentProps<typeof NuiRadioGroup>['options']>[number];

describe('NuiRadioGroup - unique name, accessibility, safeSend, and option uniqueness', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  const sampleOptions: NuiRadioOption[] = [
    { value: 'apple', label: 'Apple', description: 'Fresh red apple' },
    { value: 'banana', label: 'Banana', description: 'Ripe yellow banana' },
    { value: 'cherry', label: 'Cherry', disabled: true }
  ];

  it('generates a unique group name using $props.id() when name is omitted', () => {
    const instance = mount(NuiRadioGroup, {
      target: container,
      props: {
        options: sampleOptions,
        value: 'apple'
      }
    });

    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    expect(inputs.length).toBe(3);

    const generatedName = inputs[0].name;
    expect(generatedName).toMatch(/^nui-radio-/);
    // All options in this group share the same generated name
    expect(inputs[1].name).toBe(generatedName);
    expect(inputs[2].name).toBe(generatedName);

    unmount(instance);
  });

  it('ensures two distinct component instances have different generated names to prevent cross-group interference', () => {
    const container1 = document.createElement('div');
    const container2 = document.createElement('div');
    container.appendChild(container1);
    container.appendChild(container2);

    const instance1 = mount(NuiRadioGroup, {
      target: container1,
      props: {
        options: sampleOptions,
        value: 'apple'
      }
    });

    const instance2 = mount(NuiRadioGroup, {
      target: container2,
      props: {
        options: sampleOptions,
        value: 'banana'
      }
    });

    const inputs1 = container1.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    const inputs2 = container2.querySelectorAll<HTMLInputElement>('input[type="radio"]');

    expect(inputs1[0].name).toMatch(/^nui-radio-/);
    expect(inputs2[0].name).toMatch(/^nui-radio-/);
    expect(inputs1[0].name).not.toBe(inputs2[0].name);

    unmount(instance1);
    unmount(instance2);
  });

  it('allows explicit name prop to override the generated name', () => {
    const instance = mount(NuiRadioGroup, {
      target: container,
      props: {
        name: 'preferred-fruit',
        options: sampleOptions,
        value: 'apple'
      }
    });

    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    expect(inputs[0].name).toBe('preferred-fruit');
    expect(inputs[1].name).toBe('preferred-fruit');
    expect(inputs[2].name).toBe('preferred-fruit');

    unmount(instance);
  });

  it('selects option optimistically and dispatches NUI event', () => {
    const mockClient = { send: vi.fn() } as any;
    let selectedVal = 'apple';

    const instance = mount(NuiRadioGroup, {
      target: container,
      props: {
        eventName: 'nui:selectFruit',
        client: mockClient,
        options: sampleOptions,
        get value() {
          return selectedVal;
        },
        set value(v) {
          selectedVal = v;
        }
      }
    });

    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    expect(inputs[0].checked).toBe(true);
    expect(inputs[1].checked).toBe(false);

    // Click banana option
    inputs[1].click();
    flushSync();

    expect(selectedVal).toBe('banana');
    expect(mockClient.send).toHaveBeenCalledWith('nui:selectFruit', {
      value: 'banana',
      label: 'Banana'
    });

    unmount(instance);
  });

  it('catches synchronous exceptions in client.send via safeSend without breaking state', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mockClient = {
      send: vi.fn(() => {
        throw new Error('Sync transport failure');
      })
    } as any;

    let selectedVal = 'apple';

    const instance = mount(NuiRadioGroup, {
      target: container,
      props: {
        eventName: 'nui:selectFruit',
        client: mockClient,
        options: sampleOptions,
        get value() {
          return selectedVal;
        },
        set value(v) {
          selectedVal = v;
        }
      }
    });

    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    expect(() => {
      inputs[1].click();
      flushSync();
    }).not.toThrow();

    // Value is still updated optimistically
    expect(selectedVal).toBe('banana');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[fivem-nui-components] NuiRadioGroup: Failed to send event 'nui:selectFruit':",
      expect.any(Error)
    );

    unmount(instance);
  });

  it('falls back to generated autoId when name is an empty string', () => {
    const instance = mount(NuiRadioGroup, {
      target: container,
      props: {
        name: '',
        options: sampleOptions,
        value: 'apple'
      }
    });

    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    expect(inputs[0].name).toMatch(/^nui-radio-/);
    expect(inputs[1].name).toBe(inputs[0].name);

    unmount(instance);
  });

  it('prevents selection when whole group is disabled', () => {
    const mockClient = { send: vi.fn() } as any;
    let selectedVal = 'apple';

    const instance = mount(NuiRadioGroup, {
      target: container,
      props: {
        disabled: true,
        eventName: 'nui:selectFruit',
        client: mockClient,
        options: sampleOptions,
        get value() {
          return selectedVal;
        },
        set value(v) {
          selectedVal = v;
        }
      }
    });

    const fieldset = container.querySelector('fieldset');
    expect(fieldset?.disabled).toBe(true);

    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    inputs[1].click();
    flushSync();

    expect(selectedVal).toBe('apple');
    expect(mockClient.send).not.toHaveBeenCalled();

    unmount(instance);
  });

  it('prevents selection of an individual disabled option', () => {
    const mockClient = { send: vi.fn() } as any;
    let selectedVal = 'apple';

    const instance = mount(NuiRadioGroup, {
      target: container,
      props: {
        eventName: 'nui:selectFruit',
        client: mockClient,
        options: sampleOptions,
        get value() {
          return selectedVal;
        },
        set value(v) {
          selectedVal = v;
        }
      }
    });

    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    // Cherry is disabled
    expect(inputs[2].disabled).toBe(true);
    inputs[2].click();
    flushSync();

    expect(selectedVal).toBe('apple');
    expect(mockClient.send).not.toHaveBeenCalled();

    unmount(instance);
  });

  it('warns when duplicate option values are provided', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const duplicateOptions: NuiRadioOption[] = [
      { value: 'same', label: 'First' },
      { value: 'same', label: 'Second' }
    ];

    const instance = mount(NuiRadioGroup, {
      target: container,
      props: {
        options: duplicateOptions
      }
    });

    flushSync();

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[fivem-nui-components] NuiRadioGroup: Duplicate option value 'same' detected. Option values must be unique within the group."
    );

    unmount(instance);
  });

  it('renders fieldset legend, option labels, and descriptions for accessibility', () => {
    const instance = mount(NuiRadioGroup, {
      target: container,
      props: {
        label: 'Select your favorite fruit',
        options: sampleOptions,
        value: 'banana'
      }
    });

    const legend = container.querySelector('legend');
    expect(legend?.textContent).toBe('Select your favorite fruit');

    const descriptions = container.querySelectorAll('.nui-radio-description');
    expect(descriptions.length).toBe(2);
    expect(descriptions[0].textContent).toBe('Fresh red apple');
    expect(descriptions[1].textContent).toBe('Ripe yellow banana');

    const checkedOption = container.querySelector('.nui-radio-option.is-checked');
    expect(checkedOption).not.toBeNull();
    expect(checkedOption?.querySelector('.nui-radio-label')?.textContent).toBe('Banana');

    unmount(instance);
  });
});
