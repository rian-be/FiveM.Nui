import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, unmount, createRawSnippet, type ComponentProps } from 'svelte';
import { flushSync, bindState } from '../helpers/testHelper.svelte';
import NuiCard from '../../src/components/layout/NuiCard.svelte';

type CardProps = ComponentProps<typeof NuiCard> & Record<string, unknown>;
type MountedComponent = ReturnType<typeof mount>;

describe('NuiCard - stretched button pattern, accessibility, and interactions', () => {
  let container: HTMLElement;
  let mountedApps: MountedComponent[] = [];

  function mountCard(props: CardProps) {
    const target = document.createElement('div');
    container.appendChild(target);
    const inst = mount(NuiCard, {
      target,
      props: props as ComponentProps<typeof NuiCard>
    });
    mountedApps.push(inst);
    flushSync();
    const card = target.querySelector<HTMLDivElement>('.nui-card')!;
    const hit = target.querySelector<HTMLButtonElement>('.nui-card-hit');
    return { card, hit, inst, target };
  }

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    while (mountedApps.length > 0) {
      const app = mountedApps.pop()!;
      unmount(app);
    }
    container.remove();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('renders as a static <div> without .nui-card-hit when not interactive', () => {
    const { card, hit } = mountCard({
      title: 'Player Card',
      elevation: 2
    });

    expect(card).not.toBeNull();
    expect(card.tagName.toLowerCase()).toBe('div');
    expect(card.classList.contains('nui-card--elevation-2')).toBe(true);
    expect(hit).toBeNull();
  });

  it('renders a stretched <button class="nui-card-hit"> overlay when clickable is true', () => {
    const onSelect = vi.fn();
    const { card, hit } = mountCard({
      title: 'Clickable Card',
      clickable: true,
      onSelect
    });

    expect(card.tagName.toLowerCase()).toBe('div');
    expect(card.classList.contains('nui-card--interactive')).toBe(true);

    expect(hit).not.toBeNull();
    expect(hit!.tagName.toLowerCase()).toBe('button');
    expect(hit!.getAttribute('type')).toBe('button');
    expect(hit!.getAttribute('aria-pressed')).toBeNull();

    hit!.click();
    flushSync();

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toBeInstanceOf(MouseEvent);
  });

  it('infers interactive behavior when onSelect is provided without explicit clickable prop', () => {
    const onSelect = vi.fn();
    const { hit } = mountCard({
      title: 'Auto-interactive Card',
      onSelect
    });

    expect(hit).not.toBeNull();
  });

  it('handles selectable state with aria-pressed toggle semantics and binding', () => {
    const selected = bindState(false);
    const { card, hit } = mountCard({
      title: 'Selectable Card',
      selectable: true,
      get selected() {
        return selected.current;
      },
      set selected(v) {
        selected.current = v;
      }
    });

    expect(hit).not.toBeNull();
    expect(hit!.getAttribute('aria-pressed')).toBe('false');
    expect(card.classList.contains('nui-card--selected')).toBe(false);

    hit!.click();
    flushSync();

    expect(selected.current).toBe(true);
    expect(hit!.getAttribute('aria-pressed')).toBe('true');
    expect(card.classList.contains('nui-card--selected')).toBe(true);
  });

  it('does not apply aria-pressed or selected class when selected is true but selectable is false', () => {
    const { card, hit } = mountCard({
      title: 'Static Card with selected=true',
      selected: true
    });

    expect(hit).toBeNull();
    expect(card.classList.contains('nui-card--selected')).toBe(false);
    expect(card.classList.contains('nui-card--interactive')).toBe(false);
  });

  it('renders interactive button with aria-pressed when selectable is true without explicit clickable', () => {
    const { card, hit } = mountCard({
      title: 'Selectable Only Card',
      selectable: true
    });

    expect(hit).not.toBeNull();
    expect(hit!.getAttribute('aria-pressed')).toBe('false');
    expect(card.classList.contains('nui-card--interactive')).toBe(true);
  });

  it('associates aria-labelledby with the title ID', () => {
    const { card, hit } = mountCard({
      title: 'Server Settings',
      clickable: true
    });

    expect(hit).not.toBeNull();
    const titleEl = card.querySelector('.nui-card-title');
    expect(titleEl).not.toBeNull();

    const titleId = titleEl!.id;
    expect(titleId).toBeTruthy();
    expect(hit!.getAttribute('aria-labelledby')).toBe(titleId);
  });

  it('uses aria-label when title is omitted on an interactive card', () => {
    const { hit } = mountCard({
      label: 'Quick action',
      clickable: true
    });

    expect(hit).not.toBeNull();
    expect(hit!.getAttribute('aria-label')).toBe('Quick action');
    expect(hit!.getAttribute('aria-labelledby')).toBeNull();
  });

  it('defaults headingLevel to 3 (h3), renders custom levels when valid, and falls back to h3 when out of range', () => {
    const { card: defaultCard } = mountCard({
      title: 'Default H3 Card'
    });
    const defaultTitle = defaultCard.querySelector('.nui-card-title');
    expect(defaultTitle).not.toBeNull();
    expect(defaultTitle!.tagName.toLowerCase()).toBe('h3');

    for (const level of [1, 2, 4, 5, 6] as const) {
      const { card } = mountCard({
        title: `Heading Level ${level}`,
        headingLevel: level
      });
      const titleEl = card.querySelector('.nui-card-title');
      expect(titleEl).not.toBeNull();
      expect(titleEl!.tagName.toLowerCase()).toBe(`h${level}`);
    }

    for (const invalidLevel of [0, 7, -1] as const) {
      const { card } = mountCard({
        title: `Invalid Level ${invalidLevel}`,
        headingLevel: invalidLevel
      });
      const titleEl = card.querySelector('.nui-card-title');
      expect(titleEl).not.toBeNull();
      expect(titleEl!.tagName.toLowerCase()).toBe('h3');
    }
  });

  it('marks icon with aria-hidden="true"', () => {
    const { card } = mountCard({
      title: 'Vehicle',
      icon: '🚗'
    });

    const iconEl = card.querySelector('.nui-card-icon');
    expect(iconEl).not.toBeNull();
    expect(iconEl!.getAttribute('aria-hidden')).toBe('true');
    expect(iconEl!.textContent).toBe('🚗');
  });

  it('disables .nui-card-hit and suppresses onSelect on both native click and synthetic events', () => {
    const onSelect = vi.fn();
    const { card, hit } = mountCard({
      title: 'Disabled Card',
      clickable: true,
      disabled: true,
      onSelect
    });

    expect(card.classList.contains('nui-card--disabled')).toBe(true);
    expect(hit).not.toBeNull();
    expect(hit!.disabled).toBe(true);

    hit!.click();
    flushSync();
    expect(onSelect).not.toHaveBeenCalled();

    hit!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    flushSync();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does not trigger card onSelect when clicking interactive action buttons inside the header', () => {
    const actionsSnippet = createRawSnippet(() => ({
      render: () => '<button type="button" class="card-action-btn">Action</button>'
    }));

    const onCardSelect = vi.fn();
    const onActionClick = vi.fn();

    const { card } = mountCard({
      title: 'Card with Action',
      clickable: true,
      onSelect: onCardSelect,
      actions: actionsSnippet
    });

    const actionBtn = card.querySelector<HTMLButtonElement>('.card-action-btn')!;
    expect(actionBtn).not.toBeNull();
    actionBtn.addEventListener('click', onActionClick);

    // Stretched button overlay is a sibling, not an ancestor of header actions
    actionBtn.click();
    flushSync();

    expect(onActionClick).toHaveBeenCalledTimes(1);
    expect(onCardSelect).not.toHaveBeenCalled();
  });

  it('forwards rest HTML attributes and custom class to the root <div>', () => {
    const { card } = mountCard({
      title: 'Custom Card',
      class: 'my-custom-card',
      'data-testid': 'player-card-1',
      id: 'player-123'
    });

    expect(card.classList.contains('my-custom-card')).toBe(true);
    expect(card.getAttribute('data-testid')).toBe('player-card-1');
    expect(card.id).toBe('player-123');
  });

  it('forwards aria-label from rest props to the .nui-card-hit button', () => {
    const { card, hit } = mountCard({
      clickable: true,
      'aria-label': 'Card from rest aria-label'
    });

    expect(hit).not.toBeNull();
    expect(hit!.getAttribute('aria-label')).toBe('Card from rest aria-label');

    // Root generic div should not have aria-label
    expect(card.getAttribute('aria-label')).toBeNull();
  });

  it('warns when an interactive card lacks an accessible name, but remains silent when title or label is provided', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

    // 1. Positive control: card with title does NOT trigger warning
    mountCard({
      title: 'Accessible Card',
      clickable: true
    });
    expect(consoleWarnSpy).not.toHaveBeenCalled();

    // 2. Positive control: non-interactive card without title or label does NOT trigger warning
    mountCard({
      elevation: 2
    });
    expect(consoleWarnSpy).not.toHaveBeenCalled();

    // 3. Interactive card without title, label, or aria-label triggers warning
    mountCard({
      clickable: true
    });

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('accessible name')
    );
  });

  it('supports controlled mode: does not mutate selected on click, passes nextSelected, and updates when parent updates prop', () => {
    const onSelect = vi.fn();
    const selectedState = bindState(true);

    const { card, hit } = mountCard({
      title: 'Controlled Card',
      selectable: true,
      controlled: true,
      get selected() {
        return selectedState.current;
      },
      set selected(v) {
        selectedState.current = v;
      },
      onSelect
    });

    expect(hit).not.toBeNull();
    expect(hit!.getAttribute('aria-pressed')).toBe('true');
    expect(card.classList.contains('nui-card--selected')).toBe(true);

    hit!.click();
    flushSync();

    // onSelect receives (event, nextSelected = false)
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][1]).toBe(false);

    // In controlled mode, local selected does not mutate without parent updating prop
    expect(hit!.getAttribute('aria-pressed')).toBe('true');
    expect(card.classList.contains('nui-card--selected')).toBe(true);

    // Parent updates prop reactively
    selectedState.current = false;
    flushSync();

    // Second half of controlled contract: UI updates reflecting parent state
    expect(hit!.getAttribute('aria-pressed')).toBe('false');
    expect(card.classList.contains('nui-card--selected')).toBe(false);
  });

  it('does not render .nui-card-body when children snippet is omitted', () => {
    const { card } = mountCard({
      title: 'No Children Card'
    });

    const body = card.querySelector('.nui-card-body');
    expect(body).toBeNull();
  });

  it('sets inert attribute on body and actions when disabled is true and removes it when enabled', () => {
    // Raw snippet produces static HTML without reactive prop binding; verifies container slot projection and inert toggling
    const childrenSnippet = createRawSnippet(() => ({
      render: () => '<p>Card body content</p>'
    }));
    const actionsSnippet = createRawSnippet(() => ({
      render: () => '<button type="button">Action</button>'
    }));

    const disabledState = bindState(true);

    const { card } = mountCard({
      title: 'Inert Card',
      get disabled() {
        return disabledState.current;
      },
      set disabled(v) {
        disabledState.current = v;
      },
      children: childrenSnippet,
      actions: actionsSnippet
    });

    expect(card.hasAttribute('inert')).toBe(false);

    const body = card.querySelector('.nui-card-body');
    expect(body).not.toBeNull();
    expect(body!.hasAttribute('inert')).toBe(true);

    const actions = card.querySelector('.nui-card-actions');
    expect(actions).not.toBeNull();
    expect(actions!.hasAttribute('inert')).toBe(true);

    // Re-enable reactively: inert attributes must be removed
    disabledState.current = false;
    flushSync();

    expect(body!.hasAttribute('inert')).toBe(false);
    expect(actions!.hasAttribute('inert')).toBe(false);
  });

  it('preserves consumer role="listitem" and does not overwrite it with undefined or group', () => {
    const { card } = mountCard({
      title: 'Item in list',
      role: 'listitem'
    });

    expect(card.getAttribute('role')).toBe('listitem');
  });

  it('assigns role="group" to non-interactive card when aria-label or aria-labelledby is provided', () => {
    const { card } = mountCard({
      'aria-label': 'Player Information Group'
    });

    expect(card.getAttribute('role')).toBe('group');
    expect(card.getAttribute('aria-label')).toBe('Player Information Group');
  });

  it('handles keyboard activation with Enter and Space on .nui-card-hit and ignores other keys', () => {
    const onSelect = vi.fn();
    const { hit } = mountCard({
      title: 'Keyboard Card',
      clickable: true,
      onSelect
    });

    expect(hit).not.toBeNull();

    // 1. Enter key activates card and calls onSelect exactly once
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    hit!.dispatchEvent(enterEvent);
    flushSync();

    expect(enterEvent.defaultPrevented).toBe(true);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toBe(enterEvent);

    // 2. Space key activates card and calls onSelect exactly once
    const spaceEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    hit!.dispatchEvent(spaceEvent);
    flushSync();

    expect(spaceEvent.defaultPrevented).toBe(true);
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect.mock.calls[1][0]).toBe(spaceEvent);

    // 3. Unrelated keys (e.g. Tab, Escape) do not trigger onSelect and are not defaultPrevented
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    hit!.dispatchEvent(tabEvent);
    flushSync();

    expect(tabEvent.defaultPrevented).toBe(false);
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('toggles selection when activated via keyboard on a selectable card', () => {
    const onSelect = vi.fn();
    const selected = bindState(false);

    const { card, hit } = mountCard({
      title: 'Selectable Keyboard Card',
      selectable: true,
      get selected() {
        return selected.current;
      },
      set selected(v) {
        selected.current = v;
      },
      onSelect
    });

    expect(hit).not.toBeNull();
    expect(hit!.getAttribute('aria-pressed')).toBe('false');

    // Press Space to toggle
    const spaceEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    hit!.dispatchEvent(spaceEvent);
    flushSync();

    expect(selected.current).toBe(true);
    expect(hit!.getAttribute('aria-pressed')).toBe('true');
    expect(card.classList.contains('nui-card--selected')).toBe(true);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][1]).toBe(true);
  });

  it('suppresses keyboard activation when the card is disabled', () => {
    const onSelect = vi.fn();
    const { hit } = mountCard({
      title: 'Disabled Keyboard Card',
      clickable: true,
      disabled: true,
      onSelect
    });

    expect(hit).not.toBeNull();

    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    hit!.dispatchEvent(enterEvent);
    flushSync();

    expect(onSelect).not.toHaveBeenCalled();

    const spaceEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    hit!.dispatchEvent(spaceEvent);
    flushSync();

    expect(onSelect).not.toHaveBeenCalled();
  });
});
