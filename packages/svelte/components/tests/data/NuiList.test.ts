import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, unmount, flushSync, type ComponentProps } from 'svelte';
import type { SvelteNuiClient } from '@fivem-nui/svelte';
import NuiList, { type NuiListItem } from '../../src/components/data/NuiList.svelte';

type ListProps = ComponentProps<typeof NuiList>;

describe('NuiList', () => {
  let container: HTMLElement;
  let mountedApps: ReturnType<typeof mount>[] = [];

  function createMockClient() {
    return {
      send: vi.fn(),
      on: vi.fn().mockReturnValue(() => {})
    } as unknown as SvelteNuiClient;
  }

  function mountList(props: ListProps = {}) {
    const target = document.createElement('div');
    container.appendChild(target);
    const inst = mount(NuiList, {
      target,
      props
    });
    mountedApps.push(inst);
    flushSync();
    const root = target.querySelector<HTMLElement>('.nui-list')!;
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

  it('renders list items with labels, icons, and descriptions', () => {
    const items: NuiListItem[] = [
      { id: '1', label: 'Inventory', icon: '🎒', description: 'View backpack' },
      { id: '2', label: 'Settings', description: 'Adjust preferences' }
    ];

    const { root } = mountList({ items });

    expect(root).not.toBeNull();
    const itemElements = root.querySelectorAll('.nui-list-item');
    expect(itemElements.length).toBe(2);

    expect(itemElements[0].textContent).toContain('Inventory');
    expect(itemElements[0].textContent).toContain('🎒');
    expect(itemElements[0].textContent).toContain('View backpack');
  });

  it('handles item clicks and dispatches item.eventName, selectEvent, and onItemClick', async () => {
    const mockClient = createMockClient();
    const onItemClick = vi.fn();

    const items: NuiListItem[] = [
      { id: 'spawn_car', label: 'Spawn Vehicle', eventName: 'vehicle:spawn', value: { model: 'adder' } }
    ];

    const { root } = mountList({
      items,
      selectEvent: 'list:selected',
      client: mockClient,
      onItemClick
    });

    const itemBtn = root.querySelector<HTMLButtonElement>('.nui-list-item-btn')!;
    itemBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await vi.waitFor(() => {
      expect(mockClient.send).toHaveBeenCalledWith('vehicle:spawn', { value: { model: 'adder' }, id: 'spawn_car' });
      expect(mockClient.send).toHaveBeenCalledWith('list:selected', { id: 'spawn_car', value: { model: 'adder' } });
      expect(onItemClick).toHaveBeenCalledWith(items[0]);
    });
  });

  it('renders switch items and toggles state via switchEvent and onSwitchToggle', async () => {
    const mockClient = createMockClient();
    const onSwitchToggle = vi.fn();

    const items: NuiListItem[] = [
      {
        id: 'hud_toggle',
        label: 'Show HUD',
        switch: true,
        switchValue: true,
        switchEvent: 'hud:toggle'
      }
    ];

    const { root } = mountList({
      items,
      client: mockClient,
      onSwitchToggle
    });

    const switchInput = root.querySelector<HTMLInputElement>('.nui-switch__input')!;
    expect(switchInput).not.toBeNull();
    expect(switchInput.checked).toBe(true);

    switchInput.checked = false;
    switchInput.dispatchEvent(new Event('change', { bubbles: true }));

    await vi.waitFor(() => {
      expect(mockClient.send).toHaveBeenCalledWith('hud:toggle', { value: false, id: 'hud_toggle' });
      expect(onSwitchToggle).toHaveBeenCalledWith(items[0], false);
    });
  });

  it('ignores interactions on disabled items', () => {
    const mockClient = createMockClient();
    const onItemClick = vi.fn();

    const items: NuiListItem[] = [
      { id: 'locked', label: 'Locked Item', disabled: true, eventName: 'locked:event' }
    ];

    const { root } = mountList({
      items,
      client: mockClient,
      onItemClick
    });

    const itemBtn = root.querySelector<HTMLButtonElement>('.nui-list-item-btn')!;
    itemBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    flushSync();

    expect(mockClient.send).not.toHaveBeenCalled();
    expect(onItemClick).not.toHaveBeenCalled();
  });
});
