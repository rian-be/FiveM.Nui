import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  nuiClickOutside,
  createClickOutsideHandler,
  resolveElement,
  type NuiClickOutsideParameter
} from '../../src/actions/clickOutside';

describe('nuiClickOutside action & createClickOutsideHandler', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'target-panel';
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('triggers onClickOutside when clicking outside with left mouse button', () => {
    container.innerHTML = `<button id="insideBtn">Inside</button>`;
    const outsideBtn = document.createElement('button');
    outsideBtn.id = 'outsideBtn';
    document.body.appendChild(outsideBtn);

    const onClickOutside = vi.fn();
    const action = nuiClickOutside(container, onClickOutside);

    // Click inside
    const insideBtn = container.querySelector<HTMLElement>('#insideBtn')!;
    insideBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
    expect(onClickOutside).not.toHaveBeenCalled();

    // Right-click outside (button = 2) should be ignored
    outsideBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 2 }));
    expect(onClickOutside).not.toHaveBeenCalled();

    // Left-click outside (button = 0)
    outsideBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
    expect(onClickOutside).toHaveBeenCalledTimes(1);

    action.destroy?.();
    outsideBtn.remove();
  });

  it('safely handles ignore with elements, string selectors, getters, and undefined/null', () => {
    const triggerBtn = document.createElement('button');
    triggerBtn.id = 'triggerBtn';
    document.body.appendChild(triggerBtn);

    const ignoredModal = document.createElement('div');
    ignoredModal.className = 'ignored-modal';
    const ignoredChild = document.createElement('span');
    ignoredModal.appendChild(ignoredChild);
    document.body.appendChild(ignoredModal);

    const getterEl = document.createElement('div');
    getterEl.id = 'getterEl';
    document.body.appendChild(getterEl);

    const onClickOutside = vi.fn();

    const action = nuiClickOutside(container, {
      onClickOutside,
      ignore: [
        triggerBtn,
        '.ignored-modal',
        () => getterEl,
        undefined,
        null
      ]
    });

    // 1. Click on direct ignored element
    triggerBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
    expect(onClickOutside).not.toHaveBeenCalled();

    // 2. Click on child inside ignored selector element
    ignoredChild.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
    expect(onClickOutside).not.toHaveBeenCalled();

    // 3. Click on getter element
    getterEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
    expect(onClickOutside).not.toHaveBeenCalled();

    // 4. Click truly outside
    const outside = document.createElement('div');
    document.body.appendChild(outside);
    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
    expect(onClickOutside).toHaveBeenCalledTimes(1);

    action.destroy?.();
    triggerBtn.remove();
    ignoredModal.remove();
    getterEl.remove();
    outside.remove();
  });

  it('reads enabled dynamically on event without re-binding listener', () => {
    const outside = document.createElement('div');
    document.body.appendChild(outside);

    let isEnabled = false;
    const onClickOutside = vi.fn();

    // Listen on document to check if addEventListener is re-called
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

    const action = nuiClickOutside(container, {
      onClickOutside,
      enabled: () => isEnabled
    });

    // Initially 1 listener added
    expect(addEventListenerSpy).toHaveBeenCalledTimes(1);

    // Click outside while enabled: false
    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
    expect(onClickOutside).not.toHaveBeenCalled();

    // Enable via state change
    isEnabled = true;
    action.update?.({
      onClickOutside,
      enabled: () => isEnabled
    });

    // Update with same capture (true) does NOT re-bind listener!
    expect(addEventListenerSpy).toHaveBeenCalledTimes(1);

    // Now click outside fires
    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
    expect(onClickOutside).toHaveBeenCalledTimes(1);

    action.destroy?.();
    outside.remove();
  });

  it('re-binds listener only when capture option changes', () => {
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

    const action = nuiClickOutside(container, {
      capture: true
    });
    expect(addEventListenerSpy).toHaveBeenCalledTimes(1);

    // Update with capture: false should re-bind
    action.update?.({
      capture: false
    });
    expect(addEventListenerSpy).toHaveBeenCalledTimes(2);

    action.destroy?.();
  });

  it('cleans up event listeners on destroy', () => {
    const outside = document.createElement('div');
    document.body.appendChild(outside);

    const onClickOutside = vi.fn();
    const action = nuiClickOutside(container, onClickOutside);

    action.destroy?.();

    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
    expect(onClickOutside).not.toHaveBeenCalled();

    outside.remove();
  });

  it('resolveElement resolves string, function getter, element, and null/undefined', () => {
    const el = document.createElement('div');
    el.id = 'res-test';
    document.body.appendChild(el);

    expect(resolveElement('#res-test')).toBe(el);
    expect(resolveElement(() => el)).toBe(el);
    expect(resolveElement(el)).toBe(el);
    expect(resolveElement(null)).toBeNull();
    expect(resolveElement(undefined)).toBeNull();

    el.remove();
  });
});
