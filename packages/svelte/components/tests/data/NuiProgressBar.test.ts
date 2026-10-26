import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, unmount, flushSync, type ComponentProps } from 'svelte';
import type { SvelteNuiClient } from '@fivem-nui/svelte';
import NuiProgressBar from '../../src/components/data/NuiProgressBar.svelte';

type ProgressBarProps = ComponentProps<typeof NuiProgressBar>;

describe('NuiProgressBar', () => {
  let container: HTMLElement;
  let mountedApps: ReturnType<typeof mount>[] = [];

  function createMockClient() {
    return {
      send: vi.fn(),
      on: vi.fn().mockReturnValue(() => {})
    } as unknown as SvelteNuiClient;
  }

  function mountProgressBar(props: ProgressBarProps = {}) {
    const target = document.createElement('div');
    container.appendChild(target);
    const inst = mount(NuiProgressBar, {
      target,
      props
    });
    mountedApps.push(inst);
    flushSync();
    const track = target.querySelector<HTMLElement>('.nui-progress-bar__track')!;
    const fill = target.querySelector<HTMLElement>('.nui-progress-bar__fill')!;
    return { track, fill, inst, target };
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

  it('renders progress track and fill with default values (0%)', () => {
    const { track, fill } = mountProgressBar();

    expect(track).not.toBeNull();
    expect(track.getAttribute('aria-valuenow')).toBe('0');
    expect(track.getAttribute('aria-valuemax')).toBe('100');
    expect(track.getAttribute('aria-valuemin')).toBe('0');
    expect(fill.style.width).toBe('0%');
  });

  it('calculates percentage accurately and renders top label and percentage', () => {
    const { track, fill, target } = mountProgressBar({
      value: 45,
      max: 90,
      label: 'Loading assets',
      showPercentage: true,
      labelPosition: 'top'
    });

    expect(track.getAttribute('aria-valuenow')).toBe('45');
    expect(track.getAttribute('aria-valuemax')).toBe('90');
    expect(track.getAttribute('aria-valuetext')).toBe('50%');
    expect(fill.style.width).toBe('50%');

    const percentText = target.querySelector('.nui-progress-bar__percent')?.textContent;
    expect(percentText).toBe('50%');
    expect(target.textContent).toContain('Loading assets');
  });

  it('renders inside label when labelPosition is set to inside', () => {
    const { fill } = mountProgressBar({
      value: 60,
      label: 'Processing...',
      labelPosition: 'inside'
    });

    const innerLabel = fill.querySelector('.nui-progress-bar__inner-label');
    expect(innerLabel?.textContent?.trim()).toBe('Processing...');
  });

  it('triggers onComplete and completeEvent when reaching 100%', () => {
    const mockClient = createMockClient();
    const onComplete = vi.fn();

    mountProgressBar({
      value: 100,
      max: 100,
      completeEvent: 'progress:finished',
      client: mockClient,
      onComplete
    });

    expect(onComplete).toHaveBeenCalled();
    expect(mockClient.send).toHaveBeenCalledWith('progress:finished', { value: 100, max: 100 });
  });

  it('subscribes to eventName for remote progress updates', () => {
    let messageHandler: ((payload: unknown) => void) | null = null;
    const mockClient = {
      send: vi.fn(),
      on: vi.fn((_event: string, cb: (payload: unknown) => void) => {
        messageHandler = cb;
        return () => {};
      })
    } as unknown as SvelteNuiClient;

    const { track, fill } = mountProgressBar({
      value: 10,
      max: 100,
      eventName: 'game:resource:progress',
      client: mockClient
    });

    expect(mockClient.on).toHaveBeenCalledWith('game:resource:progress', expect.any(Function));

    messageHandler!(75);
    flushSync();

    expect(track.getAttribute('aria-valuenow')).toBe('75');
    expect(fill.style.width).toBe('75%');

    messageHandler!({ value: 150, max: 200 });
    flushSync();

    expect(track.getAttribute('aria-valuenow')).toBe('150');
    expect(track.getAttribute('aria-valuemax')).toBe('200');
    expect(fill.style.width).toBe('75%');
  });

  it('supports custom color and size/variant styling', () => {
    const { fill, target } = mountProgressBar({
      color: '#ff5500',
      variant: 'warning',
      size: 'lg'
    });

    expect(target.querySelector('.nui-progress-bar--lg')).not.toBeNull();
    expect(fill.classList.contains('nui-progress-bar__fill--warning')).toBe(true);
    expect(fill.style.background).toBe('#ff5500');
  });
});
