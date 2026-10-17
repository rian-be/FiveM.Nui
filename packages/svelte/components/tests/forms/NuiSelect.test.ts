import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, unmount, type ComponentProps } from 'svelte';
import { bindState, flushSync } from '../helpers/testHelper.svelte';
import NuiSelect from '../../src/components/forms/NuiSelect.svelte';

type NuiSelectOption = NonNullable<ComponentProps<typeof NuiSelect>['options']>[number];

describe('NuiSelect - value normalization, accessibility, keyboard, and event contract', () => {
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

  const sampleOptions: NuiSelectOption[] = [
    { value: 'opt1', label: 'Option 1' },
    { value: 'opt2', label: 'Option 2' },
    { value: 'opt3', label: 'Option 3', disabled: true }
  ];

  it('safely normalizes malformed or object JSON strings in multiple mode without throwing', () => {
    let currentVal = '{}';

    const instance = mount(NuiSelect, {
      target: container,
      props: {
        multiple: true,
        options: sampleOptions,
        get value() {
          return currentVal;
        },
        set value(v) {
          currentVal = v;
        }
      }
    });

    const trigger = container.querySelector<HTMLButtonElement>('.nui-select__trigger');
    expect(trigger).not.toBeNull();
    // Does not crash and displays placeholder
    expect(trigger?.textContent).toContain('Select...');

    unmount(instance);
  });

  it('does not display clear button when multiple selection is empty array', () => {
    const instance = mount(NuiSelect, {
      target: container,
      props: {
        multiple: true,
        options: sampleOptions,
        value: '[]'
      }
    });

    const clearButton = container.querySelector('.nui-select__clear');
    expect(clearButton).toBeNull();

    unmount(instance);
  });

  it('displays clear button when multiple selection has items and clears correctly', () => {
    const mockClient = { send: vi.fn() } as any;
    let currentVal = '["opt1"]';

    const instance = mount(NuiSelect, {
      target: container,
      props: {
        eventName: 'nui:selectChange',
        client: mockClient,
        multiple: true,
        options: sampleOptions,
        get value() {
          return currentVal;
        },
        set value(v) {
          currentVal = v;
        }
      }
    });

    const clearButton = container.querySelector<HTMLButtonElement>('.nui-select__clear');
    expect(clearButton).not.toBeNull();

    clearButton?.click();
    flushSync();

    expect(currentVal).toBe('[]');
    expect(mockClient.send).toHaveBeenCalledWith('nui:selectChange', {
      value: [],
      multiple: true
    });

    unmount(instance);
  });

  it('dispatches unified full selection payload in multiple mode upon option selection', () => {
    const mockClient = { send: vi.fn() } as any;
    let currentVal = '["opt1"]';

    const instance = mount(NuiSelect, {
      target: container,
      props: {
        eventName: 'nui:selectChange',
        client: mockClient,
        multiple: true,
        options: sampleOptions,
        get value() {
          return currentVal;
        },
        set value(v) {
          currentVal = v;
        }
      }
    });

    const trigger = container.querySelector<HTMLButtonElement>('.nui-select__trigger');
    trigger?.click();
    flushSync();

    // Open dropdown and click Option 2
    const optButtons = container.querySelectorAll<HTMLElement>('.nui-select__option');
    expect(optButtons.length).toBe(3);

    optButtons[1].click();
    flushSync();

    expect(currentVal).toBe(JSON.stringify(['opt1', 'opt2']));
    expect(mockClient.send).toHaveBeenCalledWith('nui:selectChange', {
      value: ['opt1', 'opt2'],
      option: { value: 'opt2', label: 'Option 2' },
      multiple: true
    });

    unmount(instance);
  });

  it('prevents opening and option selection when disabled={true}', () => {
    const mockClient = { send: vi.fn() } as any;
    let currentVal = 'opt1';

    const instance = mount(NuiSelect, {
      target: container,
      props: {
        disabled: true,
        eventName: 'nui:selectChange',
        client: mockClient,
        options: sampleOptions,
        get value() {
          return currentVal;
        },
        set value(v) {
          currentVal = v;
        }
      }
    });

    const trigger = container.querySelector<HTMLButtonElement>('.nui-select__trigger');
    expect(trigger?.disabled).toBe(true);

    trigger?.click();
    flushSync();

    const panel = container.querySelector('.nui-select__panel');
    expect(panel).toBeNull();

    unmount(instance);
  });

  it('auto-closes dropdown when disabled becomes true while open', () => {
    const isDisabled = bindState(false);

    const instance = mount(NuiSelect, {
      target: container,
      props: {
        options: sampleOptions,
        value: 'opt1',
        get disabled() {
          return isDisabled.current;
        }
      }
    });

    const trigger = container.querySelector<HTMLButtonElement>('.nui-select__trigger');
    trigger?.click();
    flushSync();

    expect(container.querySelector('.nui-select__panel')).not.toBeNull();

    isDisabled.current = true;
    flushSync();

    expect(container.querySelector('.nui-select__panel')).toBeNull();

    unmount(instance);
  });

  it('implements complete ARIA listbox sematics without nested interactive elements', () => {
    const instance = mount(NuiSelect, {
      target: container,
      props: {
        label: 'Choose an option',
        options: sampleOptions,
        value: 'opt1'
      }
    });

    const control = container.querySelector('.nui-select__control');
    const trigger = container.querySelector<HTMLButtonElement>('button.nui-select__trigger');
    const clearBtn = container.querySelector('button.nui-select__clear');

    // Trigger is a button
    expect(trigger).not.toBeNull();
    expect(trigger?.getAttribute('aria-haspopup')).toBe('listbox');
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');

    // Clear button is a sibling, NOT nested inside trigger
    expect(trigger?.contains(clearBtn)).toBe(false);
    expect(control?.contains(trigger)).toBe(true);
    expect(control?.contains(clearBtn)).toBe(true);

    // Open dropdown to verify listbox semantics
    trigger?.click();
    flushSync();

    const listbox = container.querySelector('[role="listbox"]');
    expect(listbox).not.toBeNull();

    const options = container.querySelectorAll('[role="option"]');
    expect(options.length).toBe(3);
    expect(options[0].getAttribute('aria-selected')).toBe('true');
    expect(options[1].getAttribute('aria-selected')).toBe('false');
    expect(options[2].getAttribute('aria-disabled')).toBe('true');

    unmount(instance);
  });

  it('supports keyboard navigation via ArrowDown, ArrowUp, Enter, and Escape', () => {
    let currentVal = 'opt1';

    const instance = mount(NuiSelect, {
      target: container,
      props: {
        options: sampleOptions,
        searchable: false,
        get value() {
          return currentVal;
        },
        set value(v) {
          currentVal = v;
        }
      }
    });

    const trigger = container.querySelector<HTMLButtonElement>('.nui-select__trigger')!;

    // ArrowDown on trigger opens dropdown and focuses next item
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    flushSync();

    expect(container.querySelector('[role="listbox"]')).not.toBeNull();

    // ArrowDown moves focus to Option 2
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    flushSync();

    const opt2 = container.querySelector('.nui-select__option:nth-child(2)');
    expect(opt2?.classList.contains('is-focused')).toBe(true);

    // Enter selects focused Option 2 and closes dropdown
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    flushSync();

    expect(currentVal).toBe('opt2');
    expect(container.querySelector('[role="listbox"]')).toBeNull();

    unmount(instance);
  });

  it('generates unique IDs per instance even when components share identical name prop', () => {
    const c1 = document.createElement('div');
    const c2 = document.createElement('div');
    container.appendChild(c1);
    container.appendChild(c2);

    const inst1 = mount(NuiSelect, {
      target: c1,
      props: { name: 'role', options: sampleOptions, label: 'Role 1' }
    });

    const inst2 = mount(NuiSelect, {
      target: c2,
      props: { name: 'role', options: sampleOptions, label: 'Role 2' }
    });

    const trigger1 = c1.querySelector('button.nui-select__trigger');
    const trigger2 = c2.querySelector('button.nui-select__trigger');

    expect(trigger1?.id).toMatch(/^nui-select-/);
    expect(trigger2?.id).toMatch(/^nui-select-/);
    expect(trigger1?.id).not.toBe(trigger2?.id);

    unmount(inst1);
    unmount(inst2);
  });

  it('synchronizes focusedIndex with filtered options when searching', () => {
    const inst = mount(NuiSelect, {
      target: container,
      props: {
        options: sampleOptions,
        searchable: true,
        value: 'opt1'
      }
    });

    const trigger = container.querySelector<HTMLButtonElement>('button.nui-select__trigger')!;
    trigger.click();
    flushSync();

    const searchInput = container.querySelector<HTMLInputElement>('.nui-select__search')!;
    expect(searchInput).not.toBeNull();

    // Type query matching only Option 2
    searchInput.value = 'Option 2';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();

    const visibleOptions = container.querySelectorAll('.nui-select__option');
    expect(visibleOptions.length).toBe(1);
    // Option 2 is automatically focused
    expect(visibleOptions[0].classList.contains('is-focused')).toBe(true);
    expect(searchInput.getAttribute('aria-activedescendant')).toContain('-opt-0');

    unmount(inst);
  });

  it('guarantees single combobox role: omitted on trigger when searchable, present on trigger when not searchable', () => {
    const instSearchable = mount(NuiSelect, {
      target: container,
      props: { options: sampleOptions, searchable: true }
    });

    const triggerSearchable = container.querySelector('button.nui-select__trigger');
    expect(triggerSearchable?.getAttribute('role')).toBeNull();

    unmount(instSearchable);

    const instNonSearchable = mount(NuiSelect, {
      target: container,
      props: { options: sampleOptions, searchable: false }
    });

    const triggerNonSearchable = container.querySelector('button.nui-select__trigger');
    expect(triggerNonSearchable?.getAttribute('role')).toBe('combobox');

    unmount(instNonSearchable);
  });

  it('handles async rejected promise in safeSend without unhandled rejection', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const rejectionPromise = Promise.reject(new Error('Async NUI failure'));

    const mockClient = {
      send: vi.fn(() => rejectionPromise)
    } as any;

    let currentVal = 'opt1';

    const inst = mount(NuiSelect, {
      target: container,
      props: {
        eventName: 'nui:change',
        client: mockClient,
        options: sampleOptions,
        get value() {
          return currentVal;
        },
        set value(v) {
          currentVal = v;
        }
      }
    });

    const trigger = container.querySelector<HTMLButtonElement>('button.nui-select__trigger')!;
    trigger.click();
    flushSync();

    const optButtons = container.querySelectorAll<HTMLElement>('.nui-select__option');
    optButtons[1].click();
    flushSync();

    expect(currentVal).toBe('opt2');

    await expect(rejectionPromise).rejects.toThrow('Async NUI failure');
    await new Promise((r) => setTimeout(r, 10));

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[fivem-nui-components] NuiSelect: Async error sending event 'nui:change':",
      expect.any(Error)
    );

    unmount(inst);
  });

  it('navigates with ArrowDown/ArrowUp on open trigger without selecting', () => {
    let currentVal = 'opt1';

    const inst = mount(NuiSelect, {
      target: container,
      props: {
        options: sampleOptions,
        searchable: false,
        get value() {
          return currentVal;
        },
        set value(v) {
          currentVal = v;
        }
      }
    });

    const trigger = container.querySelector<HTMLButtonElement>('button.nui-select__trigger')!;
    // Open dropdown
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    flushSync();

    expect(container.querySelector('[role="listbox"]')).not.toBeNull();
    // Initially focused on opt1
    expect(currentVal).toBe('opt1');

    // ArrowDown on open trigger moves focus to Option 2 without selecting it
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    flushSync();

    // Value should NOT have changed to opt2 yet
    expect(currentVal).toBe('opt1');
    const opt2 = container.querySelector('.nui-select__option:nth-child(2)');
    expect(opt2?.classList.contains('is-focused')).toBe(true);

    // Only Enter selects and updates the value
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    flushSync();

    expect(currentVal).toBe('opt2');

    unmount(inst);
  });

  it('preserves initial selected option upon opening instead of resetting to index 0', () => {
    const inst = mount(NuiSelect, {
      target: container,
      props: {
        options: sampleOptions,
        value: 'opt2',
        searchable: false
      }
    });

    const trigger = container.querySelector<HTMLButtonElement>('button.nui-select__trigger')!;
    trigger.click();
    flushSync();

    const opt2 = container.querySelector('.nui-select__option:nth-child(2)');
    expect(opt2?.classList.contains('is-focused')).toBe(true);

    unmount(inst);
  });

  it('preserves active option by value when options array reference updates while open', () => {
    const opts = bindState([...sampleOptions]);

    const inst = mount(NuiSelect, {
      target: container,
      props: {
        get options() {
          return opts.current;
        },
        value: 'opt2',
        searchable: false
      }
    });

    const trigger = container.querySelector<HTMLButtonElement>('button.nui-select__trigger')!;
    trigger.click();
    flushSync();

    const opt2 = container.querySelector('.nui-select__option:nth-child(2)');
    expect(opt2?.classList.contains('is-focused')).toBe(true);

    // Insert a new option at the beginning
    opts.current = [{ value: 'opt0', label: 'Option 0' }, ...sampleOptions];
    flushSync();

    // opt2 should still be focused (now at child index 3)
    const optionsEls = container.querySelectorAll('.nui-select__option');
    expect(optionsEls.length).toBe(4);
    expect(optionsEls[2].classList.contains('is-focused')).toBe(true);
    expect(optionsEls[2].textContent).toContain('Option 2');

    unmount(inst);
  });

  it('navigates with Home and End in searchable mode', () => {
    const inst = mount(NuiSelect, {
      target: container,
      props: {
        options: sampleOptions,
        searchable: true,
        value: 'opt2'
      }
    });

    const trigger = container.querySelector<HTMLButtonElement>('button.nui-select__trigger')!;
    trigger.click();
    flushSync();

    const searchInput = container.querySelector<HTMLInputElement>('input.nui-select__search')!;
    expect(searchInput).not.toBeNull();

    // Home jumps to first enabled option (opt1)
    searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    flushSync();

    const opt1 = container.querySelector('.nui-select__option:nth-child(1)');
    expect(opt1?.classList.contains('is-focused')).toBe(true);
    expect(searchInput.getAttribute('aria-activedescendant')).toContain('-opt-0');

    // End jumps to last enabled option (opt2, since opt3 is disabled)
    searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    flushSync();

    const opt2 = container.querySelector('.nui-select__option:nth-child(2)');
    expect(opt2?.classList.contains('is-focused')).toBe(true);
    expect(searchInput.getAttribute('aria-activedescendant')).toContain('-opt-1');

    unmount(inst);
  });

  it('falls back to first enabled option if active option is removed when options update while open', () => {
    const opts = bindState([...sampleOptions]);

    const inst = mount(NuiSelect, {
      target: container,
      props: {
        get options() {
          return opts.current;
        },
        value: 'opt2',
        searchable: false
      }
    });

    const trigger = container.querySelector<HTMLButtonElement>('button.nui-select__trigger')!;
    trigger.click();
    flushSync();

    const opt2 = container.querySelector('.nui-select__option:nth-child(2)');
    expect(opt2?.classList.contains('is-focused')).toBe(true);

    // Remove opt2 from options list
    opts.current = [
      { value: 'opt1', label: 'Option 1' },
      { value: 'opt3', label: 'Option 3', disabled: true }
    ];
    flushSync();

    // Should fall back to opt1 (first enabled option)
    const opt1 = container.querySelector('.nui-select__option:nth-child(1)');
    expect(opt1?.classList.contains('is-focused')).toBe(true);

    unmount(inst);
  });

  it('handles empty search results with no active descendant and empty presentation', () => {
    const inst = mount(NuiSelect, {
      target: container,
      props: {
        options: sampleOptions,
        searchable: true
      }
    });

    const trigger = container.querySelector<HTMLButtonElement>('button.nui-select__trigger')!;
    trigger.click();
    flushSync();

    const searchInput = container.querySelector<HTMLInputElement>('input.nui-select__search')!;
    searchInput.value = 'nonexistent';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();

    expect(container.querySelector('.nui-select__empty')).not.toBeNull();
    expect(container.querySelectorAll('.nui-select__option').length).toBe(0);
    // aria-activedescendant should be removed/null
    expect(searchInput.getAttribute('aria-activedescendant')).toBeNull();

    unmount(inst);
  });

  it('handles all options disabled safely', () => {
    const allDisabled: NuiSelectOption[] = [
      { value: 'd1', label: 'Disabled 1', disabled: true },
      { value: 'd2', label: 'Disabled 2', disabled: true }
    ];

    const inst = mount(NuiSelect, {
      target: container,
      props: {
        options: allDisabled,
        searchable: false
      }
    });

    const trigger = container.querySelector<HTMLButtonElement>('button.nui-select__trigger')!;
    trigger.click();
    flushSync();

    // No option should be focused
    const focusedOpt = container.querySelector('.nui-select__option.is-focused');
    expect(focusedOpt).toBeNull();

    const listbox = container.querySelector('[role="listbox"]')!;
    expect(listbox.getAttribute('aria-activedescendant')).toBeNull();

    // Arrow navigation does nothing
    listbox.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    flushSync();
    expect(container.querySelector('.nui-select__option.is-focused')).toBeNull();

    unmount(inst);
  });

  it('hidden input correctly reflects single value vs serialized JSON in multiple mode', () => {
    let currentSingle = 'opt1';
    const singleInst = mount(NuiSelect, {
      target: container,
      props: {
        options: sampleOptions,
        name: 'singleField',
        get value() {
          return currentSingle;
        },
        set value(v) {
          currentSingle = v;
        }
      }
    });

    const singleHidden = container.querySelector<HTMLInputElement>('input[type="hidden"][name="singleField"]');
    expect(singleHidden).not.toBeNull();
    expect(singleHidden?.value).toBe('opt1');
    unmount(singleInst);

    let currentMulti = '["opt1","opt2"]';
    const multiInst = mount(NuiSelect, {
      target: container,
      props: {
        options: sampleOptions,
        multiple: true,
        name: 'multiField',
        get value() {
          return currentMulti;
        },
        set value(v) {
          currentMulti = v;
        }
      }
    });

    const multiHidden = container.querySelector<HTMLInputElement>('input[type="hidden"][name="multiField"]');
    expect(multiHidden).not.toBeNull();
    expect(multiHidden?.value).toBe('["opt1","opt2"]');
    unmount(multiInst);
  });
});


