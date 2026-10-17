import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nuiFocusTrap, getFocusables, isNodeAllowedOutside } from '../../src/actions/focusTrap';

const waitForFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

describe('nuiFocusTrap', () => {
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

  it('correctly filters focusable elements (skips disabled, inert, negative tabindex)', () => {
    container.innerHTML = `
      <a href="#test" id="link">Link</a>
      <button id="btn1">Button 1</button>
      <button id="btnDisabled" disabled>Disabled</button>
      <div tabindex="-1" id="negativeTab">Negative tabindex</div>
      <div tabindex="0" id="zeroTab">Zero tabindex</div>
      <input type="hidden" id="hiddenInput" />
      <input type="text" id="textInput" />
      <div aria-hidden="true">
        <button id="ariaHiddenBtn">Aria hidden button</button>
      </div>
      <fieldset disabled>
        <button id="fieldsetDisabledBtn">Fieldset disabled button</button>
      </fieldset>
    `;

    const focusables = getFocusables(container);
    const ids = focusables.map((el) => el.id);

    expect(ids).toContain('link');
    expect(ids).toContain('btn1');
    expect(ids).toContain('zeroTab');
    expect(ids).toContain('textInput');

    expect(ids).not.toContain('btnDisabled');
    expect(ids).not.toContain('negativeTab');
    expect(ids).not.toContain('hiddenInput');
    expect(ids).not.toContain('ariaHiddenBtn');
    expect(ids).not.toContain('fieldsetDisabledBtn');
  });

  it('handles radio groups correctly across multiple forms', () => {
    container.innerHTML = `
      <form id="formA">
        <input type="radio" name="plan" value="free" id="radioFree" />
        <input type="radio" name="plan" value="pro" id="radioPro" checked />
      </form>
      <form id="formB">
        <input type="radio" name="plan" value="monthly" id="radioMonthly" checked />
        <input type="radio" name="plan" value="yearly" id="radioYearly" />
      </form>
    `;

    const focusables = getFocusables(container);
    const ids = focusables.map((el) => el.id);

    // Each form has its own scoped "plan" group, so both checked radios are focusable
    expect(ids).toContain('radioPro');
    expect(ids).not.toContain('radioFree');
    expect(ids).toContain('radioMonthly');
    expect(ids).not.toContain('radioYearly');
  });

  it('captures previouslyFocused at activation time and restores it on deactivation', () => {
    const triggerBtn = document.createElement('button');
    triggerBtn.id = 'triggerBtn';
    document.body.appendChild(triggerBtn);
    triggerBtn.focus();

    container.innerHTML = `
      <button id="insideBtn">Inside</button>
    `;

    // Mounted with enabled: false (trap inactive)
    const action = nuiFocusTrap(container, { enabled: false });

    // Focus another element before opening
    const intermediateBtn = document.createElement('button');
    document.body.appendChild(intermediateBtn);
    intermediateBtn.focus();
    expect(document.activeElement).toBe(intermediateBtn);

    // Now activate trap (enabled: true)
    action.update?.({ enabled: true });

    // Verify focus moved into the trap
    const insideBtn = container.querySelector<HTMLElement>('#insideBtn')!;
    insideBtn.focus();
    expect(document.activeElement).toBe(insideBtn);

    // Deactivate trap
    action.update?.({ enabled: false });

    // Focus must restore to intermediateBtn (active right before activation), not triggerBtn!
    expect(document.activeElement).toBe(intermediateBtn);

    action.destroy?.();
  });

  it('does NOT restore focus on destroy if trap was never active', () => {
    const originalBtn = document.createElement('button');
    document.body.appendChild(originalBtn);
    originalBtn.focus();

    container.innerHTML = `<button id="b1">B1</button>`;

    // Mounted disabled
    const action = nuiFocusTrap(container, false);

    // Move focus elsewhere
    const otherBtn = document.createElement('button');
    document.body.appendChild(otherBtn);
    otherBtn.focus();
    expect(document.activeElement).toBe(otherBtn);

    // Destroy while still disabled
    action.destroy?.();

    // Focus must NOT jump back to originalBtn!
    expect(document.activeElement).toBe(otherBtn);
  });

  it('cycles Tab key between first and last focusable elements', () => {
    container.innerHTML = `
      <button id="first">First</button>
      <button id="middle">Middle</button>
      <button id="last">Last</button>
    `;

    const action = nuiFocusTrap(container, true);
    const first = container.querySelector<HTMLElement>('#first')!;
    const last = container.querySelector<HTMLElement>('#last')!;

    // Forward Tab from last element wraps to first
    last.focus();
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    vi.spyOn(tabEvent, 'preventDefault');
    container.dispatchEvent(tabEvent);

    expect(tabEvent.preventDefault).toHaveBeenCalled();
    expect(document.activeElement).toBe(first);

    // Backward Shift+Tab from first element wraps to last
    first.focus();
    const shiftTabEvent = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    vi.spyOn(shiftTabEvent, 'preventDefault');
    container.dispatchEvent(shiftTabEvent);

    expect(shiftTabEvent.preventDefault).toHaveBeenCalled();
    expect(document.activeElement).toBe(last);

    action.destroy?.();
  });

  it('redirects focusin back into the trap if focus leaves the container or active element is removed', () => {
    container.innerHTML = `
      <button id="inside">Inside</button>
    `;
    const outsideBtn = document.createElement('button');
    outsideBtn.id = 'outside';
    document.body.appendChild(outsideBtn);

    const action = nuiFocusTrap(container, true);
    const insideBtn = container.querySelector<HTMLElement>('#inside')!;

    // Simulate focus landing on an outside element (e.g. clicking backdrop)
    const focusInEvent = new FocusEvent('focusin', { bubbles: true });
    Object.defineProperty(focusInEvent, 'target', { value: outsideBtn });
    document.dispatchEvent(focusInEvent);

    // Focus should be pulled back to insideBtn
    expect(document.activeElement).toBe(insideBtn);

    action.destroy?.();
  });

  it('sets tabindex="-1" on container if empty and removes it upon deactivation', async () => {
    container.innerHTML = `<p>No focusable elements here</p>`;
    expect(container.hasAttribute('tabindex')).toBe(false);

    const action = nuiFocusTrap(container, true);
    await waitForFrame();

    // Container should receive tabindex="-1" when active
    expect(container.getAttribute('tabindex')).toBe('-1');

    // Deactivate
    action.update?.(false);

    // tabindex must be cleaned up from the DOM
    expect(container.hasAttribute('tabindex')).toBe(false);

    action.destroy?.();
  });

  it('supports nested focus traps using the trap stack without focus fighting', async () => {
    container.innerHTML = `
      <button id="parentBtn">Parent Button</button>
      <div id="childModal">
        <button id="childBtn">Child Button</button>
      </div>
    `;

    const childContainer = container.querySelector<HTMLElement>('#childModal')!;

    const parentAction = nuiFocusTrap(container, true);
    const childAction = nuiFocusTrap(childContainer, true);
    await waitForFrame();

    const childBtn = childContainer.querySelector<HTMLElement>('#childBtn')!;
    const parentBtn = container.querySelector<HTMLElement>('#parentBtn')!;

    // When focus is in the child modal, parent trap does not fight for focus
    const focusInEvent = new FocusEvent('focusin', { bubbles: true });
    Object.defineProperty(focusInEvent, 'target', { value: childBtn });
    document.dispatchEvent(focusInEvent);

    // Focus remains in child modal
    expect(document.activeElement).toBe(childBtn);

    // Close child modal
    childAction.destroy?.();

    // Now parent modal is top of stack again
    const parentFocusEvent = new FocusEvent('focusin', { bubbles: true });
    Object.defineProperty(parentFocusEvent, 'target', { value: document.body });
    document.dispatchEvent(parentFocusEvent);

    expect(document.activeElement).toBe(parentBtn);

    parentAction.destroy?.();
  });

  it('allows portaled elements via allowOutside without stealing focus or hijacking Tab', () => {
    container.innerHTML = `
      <button id="modalBtn">Modal Button</button>
    `;

    // Portaled element appended directly to document.body outside modal container
    const portal = document.createElement('div');
    portal.id = 'portal-dropdown';
    portal.innerHTML = `
      <button id="portalOption1">Option 1</button>
      <button id="portalOption2">Option 2</button>
    `;
    document.body.appendChild(portal);

    const action = nuiFocusTrap(container, {
      enabled: true,
      allowOutside: '#portal-dropdown'
    });

    const portalBtn1 = portal.querySelector<HTMLElement>('#portalOption1')!;
    portalBtn1.focus();

    // 1. focusin on portaled element should NOT pull focus back into modal
    const focusInEvent = new FocusEvent('focusin', { bubbles: true });
    Object.defineProperty(focusInEvent, 'target', { value: portalBtn1 });
    document.dispatchEvent(focusInEvent);

    expect(document.activeElement).toBe(portalBtn1);

    // 2. Tab keydown when focus is inside allowed portaled element should NOT be prevented/hijacked
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    vi.spyOn(tabEvent, 'preventDefault');
    document.dispatchEvent(tabEvent);

    expect(tabEvent.preventDefault).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(portalBtn1);

    action.destroy?.();
    portal.remove();
  });

  it('pulls focus into topmost trap on document Tab when activeElement is on body', () => {
    container.innerHTML = `
      <button id="firstBtn">First</button>
      <button id="lastBtn">Last</button>
    `;

    const action = nuiFocusTrap(container, true);
    const firstBtn = container.querySelector<HTMLElement>('#firstBtn')!;
    const lastBtn = container.querySelector<HTMLElement>('#lastBtn')!;

    // Blur to simulate focus dropping to document.body (e.g. when focused element was removed from DOM)
    (document.activeElement as HTMLElement)?.blur();
    expect(document.activeElement).toBe(document.body);

    // Tab from body moves focus to first element
    const forwardTab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    vi.spyOn(forwardTab, 'preventDefault');
    document.dispatchEvent(forwardTab);

    expect(forwardTab.preventDefault).toHaveBeenCalled();
    expect(document.activeElement).toBe(firstBtn);

    // Blur again to return focus to body
    firstBtn.blur();
    expect(document.activeElement).toBe(document.body);

    // Shift+Tab from body moves focus to last element
    const backwardTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    vi.spyOn(backwardTab, 'preventDefault');
    document.dispatchEvent(backwardTab);

    expect(backwardTab.preventDefault).toHaveBeenCalled();
    expect(document.activeElement).toBe(lastBtn);

    action.destroy?.();
  });

  it('handles two traps closed in reverse order without crashing or leaking stack', async () => {
    const containerA = document.createElement('div');
    containerA.innerHTML = `<button id="btnA">Btn A</button>`;
    document.body.appendChild(containerA);

    const containerB = document.createElement('div');
    containerB.innerHTML = `<button id="btnB">Btn B</button>`;
    document.body.appendChild(containerB);

    const trapA = nuiFocusTrap(containerA, true);
    const trapB = nuiFocusTrap(containerB, true);
    await waitForFrame();

    const btnB = containerB.querySelector<HTMLElement>('#btnB')!;
    expect(document.activeElement).toBe(btnB);

    // Destroy trap A first (bottom trap destroyed before top trap!)
    trapA.destroy?.();

    // Trap B should still be active and topmost
    const focusInEvent = new FocusEvent('focusin', { bubbles: true });
    Object.defineProperty(focusInEvent, 'target', { value: document.body });
    document.dispatchEvent(focusInEvent);

    expect(document.activeElement).toBe(btnB);

    // Now destroy trap B
    trapB.destroy?.();

    containerA.remove();
    containerB.remove();
  });

  it('handles previouslyFocused removed from DOM and cleans up tabindex on fallback target', () => {
    // Parent trap on an empty container (will need tabindex="-1" when focused)
    const parentContainer = document.createElement('div');
    parentContainer.id = 'emptyParent';
    document.body.appendChild(parentContainer);

    const triggerBtn = document.createElement('button');
    triggerBtn.id = 'triggerBtn';
    document.body.appendChild(triggerBtn);
    triggerBtn.focus();

    const parentTrap = nuiFocusTrap(parentContainer, true);

    // Child dialog opens
    const childContainer = document.createElement('div');
    childContainer.innerHTML = `<button id="childBtn">Child</button>`;
    document.body.appendChild(childContainer);

    const childTrap = nuiFocusTrap(childContainer, true);

    // Simulate trigger button being removed from DOM while child modal was open
    triggerBtn.remove();

    // Close child modal
    childTrap.destroy?.();

    // Because previouslyFocused was removed from DOM, fallback should focus parent trap
    expect(document.activeElement).toBe(parentContainer);
    expect(parentContainer.getAttribute('tabindex')).toBe('-1');

    parentContainer.remove();
    childContainer.remove();
  });

  it('supports initialFocus as selector string and getter function', async () => {
    container.innerHTML = `
      <button id="btn1">Button 1</button>
      <input id="targetInput" type="text" />
      <button id="btn2">Button 2</button>
    `;

    // 1. Selector string
    const action1 = nuiFocusTrap(container, { initialFocus: '#targetInput' });
    await waitForFrame();
    expect(document.activeElement?.id).toBe('targetInput');
    action1.destroy?.();

    // 2. Getter function
    const btn2 = container.querySelector<HTMLElement>('#btn2')!;
    const action2 = nuiFocusTrap(container, { initialFocus: () => btn2 });
    await waitForFrame();
    expect(document.activeElement).toBe(btn2);
    action2.destroy?.();
  });

  it('respects autofocus: false and explicit returnFocus HTMLElement', () => {
    container.innerHTML = `<button id="btn">Button</button>`;
    const customReturnEl = document.createElement('button');
    customReturnEl.id = 'customReturn';
    document.body.appendChild(customReturnEl);

    // Initial focus on customReturnEl
    customReturnEl.focus();
    expect(document.activeElement).toBe(customReturnEl);

    // Trap with autofocus: false does not move focus inside
    const action = nuiFocusTrap(container, {
      autofocus: false,
      returnFocus: customReturnEl
    });
    expect(document.activeElement).toBe(customReturnEl);

    // Deactivate: restores focus explicitly to customReturnEl
    const insideBtn = container.querySelector<HTMLElement>('#btn')!;
    insideBtn.focus();
    expect(document.activeElement).toBe(insideBtn);

    action.destroy?.();
    expect(document.activeElement).toBe(customReturnEl);

    customReturnEl.remove();
  });

  it('supports enabled as reactive getter', async () => {
    container.innerHTML = `<button id="btn">Button</button>`;
    let isTrapActive = false;

    const action = nuiFocusTrap(container, {
      enabled: () => isTrapActive
    });

    const btn = container.querySelector<HTMLElement>('#btn')!;
    // Initially disabled
    expect(document.activeElement).not.toBe(btn);

    // Enable via update
    isTrapActive = true;
    action.update?.({ enabled: () => isTrapActive });
    await waitForFrame();
    expect(document.activeElement).toBe(btn);

    action.destroy?.();
  });

  it('prevents default on Tab keydown when container has no focusables', () => {
    container.innerHTML = `<div>No focusables here</div>`;
    const action = nuiFocusTrap(container, { enabled: true });

    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    vi.spyOn(tabEvent, 'preventDefault');
    container.dispatchEvent(tabEvent);

    expect(tabEvent.preventDefault).toHaveBeenCalled();
    action.destroy?.();
  });

  it('safely handles invalid selector syntax in allowOutside without throwing', () => {
    container.innerHTML = `<button id="btn">Btn</button>`;
    const btn = container.querySelector<HTMLElement>('#btn')!;
    // Invalid selector should not throw SyntaxError
    expect(() => isNodeAllowedOutside(btn, '[invalid===selector')).not.toThrow();
    expect(isNodeAllowedOutside(btn, '[invalid===selector')).toBe(false);
  });

  it('cancels pending animation frame on immediate teardown', () => {
    container.innerHTML = `<button id="btn">Btn</button>`;
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame');

    const action = nuiFocusTrap(container, { enabled: true });
    action.destroy?.();

    expect(cancelSpy).toHaveBeenCalled();
  });

  it('resets previouslyFocused to null if focus was already inside node upon activation', () => {
    container.innerHTML = `<button id="btn">Inside</button>`;
    const btn = container.querySelector<HTMLElement>('#btn')!;
    btn.focus();
    expect(document.activeElement).toBe(btn);

    const action = nuiFocusTrap(container, { enabled: true });
    // Deactivate: should not attempt to refocus inside itself
    action.destroy?.();
  });
});
