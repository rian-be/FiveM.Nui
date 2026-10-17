import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  nuiLayer,
  resetLayerStack,
  getLayerStack,
  getTopLayer
} from '../../src/actions/layer';
import { nuiFocusTrap, getTopTrap } from '../../src/actions/focusTrap';

const waitForFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

describe('nuiLayer action & layer stack', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    resetLayerStack();
    container.remove();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('registers in layer stack and dismisses via Escape when topmost', () => {
    container.innerHTML = `<button id="btn">Modal button</button>`;
    const onDismiss = vi.fn();

    const layer = nuiLayer(container, {
      id: 'test-layer',
      onDismiss
    });

    expect(getLayerStack().length).toBe(1);
    expect(getTopLayer()?.id).toBe('test-layer');

    // Press Escape
    const escapeEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true
    });
    vi.spyOn(escapeEvent, 'preventDefault');
    document.dispatchEvent(escapeEvent);

    expect(escapeEvent.preventDefault).toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalledWith('escape');

    layer.destroy?.();
    expect(getLayerStack().length).toBe(0);
  });

  it('dismisses via click outside when topmost, but not when clicking inside', () => {
    container.innerHTML = `<button id="insideBtn">Inside</button>`;
    const outsideBtn = document.createElement('button');
    outsideBtn.id = 'outsideBtn';
    document.body.appendChild(outsideBtn);

    const onDismiss = vi.fn();
    const layer = nuiLayer(container, { onDismiss });

    // Click inside container
    const insideBtn = container.querySelector<HTMLElement>('#insideBtn')!;
    const insideClick = new PointerEvent('pointerdown', {
      bubbles: true,
      button: 0
    });
    insideBtn.dispatchEvent(insideClick);
    expect(onDismiss).not.toHaveBeenCalled();

    // Click outside container
    const outsideClick = new PointerEvent('pointerdown', {
      bubbles: true,
      button: 0
    });
    outsideBtn.dispatchEvent(outsideClick);
    expect(onDismiss).toHaveBeenCalledWith('outside');

    layer.destroy?.();
    outsideBtn.remove();
  });

  it('hierarchical layers: Escape only dismisses the topmost layer', () => {
    const parentContainer = document.createElement('div');
    parentContainer.innerHTML = `<button id="parentBtn">Parent</button>`;
    document.body.appendChild(parentContainer);

    const childContainer = document.createElement('div');
    childContainer.innerHTML = `<button id="childBtn">Child</button>`;
    document.body.appendChild(childContainer);

    const onParentDismiss = vi.fn();
    const onChildDismiss = vi.fn();

    const parentLayer = nuiLayer(parentContainer, { id: 'parent', onDismiss: onParentDismiss });
    const childLayer = nuiLayer(childContainer, { id: 'child', onDismiss: onChildDismiss });

    expect(getLayerStack().length).toBe(2);
    expect(getTopLayer()?.id).toBe('child');

    // 1. Press Escape: should only dismiss the topmost (child) layer!
    const escape1 = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.dispatchEvent(escape1);

    expect(onChildDismiss).toHaveBeenCalledTimes(1);
    expect(onChildDismiss).toHaveBeenCalledWith('escape');
    expect(onParentDismiss).not.toHaveBeenCalled();

    // 2. Child layer is destroyed/closed
    childLayer.destroy?.();
    expect(getLayerStack().length).toBe(1);
    expect(getTopLayer()?.id).toBe('parent');

    // 3. Press Escape again: now parent layer receives Escape
    const escape2 = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.dispatchEvent(escape2);

    expect(onParentDismiss).toHaveBeenCalledTimes(1);
    expect(onParentDismiss).toHaveBeenCalledWith('escape');

    parentLayer.destroy?.();
    parentContainer.remove();
    childContainer.remove();
  });

  it('hierarchical layers: outside click only dismisses the topmost layer', () => {
    const parentModal = document.createElement('div');
    parentModal.innerHTML = `<button id="pBtn">Parent</button>`;
    document.body.appendChild(parentModal);

    const childDialog = document.createElement('div');
    childDialog.innerHTML = `<button id="cBtn">Child</button>`;
    document.body.appendChild(childDialog);

    const onParentDismiss = vi.fn();
    const onChildDismiss = vi.fn();

    const parentLayer = nuiLayer(parentModal, { id: 'parent', onDismiss: onParentDismiss });
    const childLayer = nuiLayer(childDialog, { id: 'child', onDismiss: onChildDismiss });

    // User clicks on parent modal (backdrop/underlying layer)
    const clickOnParent = new PointerEvent('pointerdown', { bubbles: true, button: 0 });
    parentModal.dispatchEvent(clickOnParent);

    // Only childDialog is dismissed; parentModal does NOT dismiss!
    expect(onChildDismiss).toHaveBeenCalledWith('outside');
    expect(onParentDismiss).not.toHaveBeenCalled();

    parentLayer.destroy?.();
    childLayer.destroy?.();
    parentModal.remove();
    childDialog.remove();
  });

  it('respects allowOutside without triggering outside click or breaking focus trap', () => {
    container.innerHTML = `<button id="modalBtn">Modal</button>`;

    const portal = document.createElement('div');
    portal.id = 'select-portal';
    portal.innerHTML = `<button id="portalOption">Option</button>`;
    document.body.appendChild(portal);

    const onDismiss = vi.fn();
    const layer = nuiLayer(container, {
      onDismiss,
      allowOutside: '#select-portal'
    });

    const portalBtn = portal.querySelector<HTMLElement>('#portalOption')!;

    // Clicking inside portaled select dropdown
    const portalClick = new PointerEvent('pointerdown', { bubbles: true, button: 0 });
    portalBtn.dispatchEvent(portalClick);

    // Should NOT trigger outside click
    expect(onDismiss).not.toHaveBeenCalled();

    layer.destroy?.();
    portal.remove();
  });

  it('respects ignoreOutside for trigger buttons', () => {
    container.innerHTML = `<button id="modalBtn">Modal</button>`;

    const triggerBtn = document.createElement('button');
    triggerBtn.id = 'toggleBtn';
    document.body.appendChild(triggerBtn);

    const onDismiss = vi.fn();
    const layer = nuiLayer(container, {
      onDismiss,
      ignoreOutside: [triggerBtn]
    });

    // Clicking the trigger button
    const triggerClick = new PointerEvent('pointerdown', { bubbles: true, button: 0 });
    triggerBtn.dispatchEvent(triggerClick);

    // Should NOT trigger outside click
    expect(onDismiss).not.toHaveBeenCalled();

    layer.destroy?.();
    triggerBtn.remove();
  });

  it('integrates focus trap to confine Tab and restores focus on deactivation', () => {
    const triggerBtn = document.createElement('button');
    triggerBtn.id = 'origTrigger';
    document.body.appendChild(triggerBtn);
    triggerBtn.focus();

    container.innerHTML = `
      <button id="first">First</button>
      <button id="last">Last</button>
    `;

    const layer = nuiLayer(container, {
      enabled: true,
      trapFocus: true,
      returnFocus: true
    });

    const first = container.querySelector<HTMLElement>('#first')!;
    const last = container.querySelector<HTMLElement>('#last')!;

    // Tab key wrapping: Shift+Tab on first element wraps to last
    first.focus();
    const shiftTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    vi.spyOn(shiftTab, 'preventDefault');
    container.dispatchEvent(shiftTab);

    expect(shiftTab.preventDefault).toHaveBeenCalled();
    expect(document.activeElement).toBe(last);

    // Deactivate layer: focus restores to triggerBtn
    layer.destroy?.();
    expect(document.activeElement).toBe(triggerBtn);

    triggerBtn.remove();
  });

  it('orders layers by priority override', () => {
    const normalModal = document.createElement('div');
    normalModal.innerHTML = `<button id="m1">Modal 1</button>`;
    document.body.appendChild(normalModal);

    const criticalAlert = document.createElement('div');
    criticalAlert.innerHTML = `<button id="m2">Critical Alert</button>`;
    document.body.appendChild(criticalAlert);

    const onAlertDismiss = vi.fn();
    const onModalDismiss = vi.fn();

    // Critical alert registered FIRST with priority: 10
    const alertLayer = nuiLayer(criticalAlert, {
      id: 'alert',
      priority: 10,
      onDismiss: onAlertDismiss
    });

    // Normal modal registered AFTER with priority: 0
    const modalLayer = nuiLayer(normalModal, {
      id: 'modal',
      priority: 0,
      onDismiss: onModalDismiss
    });

    // Even though normalModal was opened later, criticalAlert has higher priority!
    expect(getTopLayer()?.id).toBe('alert');

    // Press Escape: dismisses the critical alert with higher priority
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.dispatchEvent(escape);

    expect(onAlertDismiss).toHaveBeenCalledWith('escape');
    expect(onModalDismiss).not.toHaveBeenCalled();

    alertLayer.destroy?.();
    modalLayer.destroy?.();
    normalModal.remove();
    criticalAlert.remove();
  });

  it('handles dynamic enabling and disabling via update', () => {
    container.innerHTML = `<button id="btn">Button</button>`;
    const onDismiss = vi.fn();

    // Starts disabled
    const layer = nuiLayer(container, {
      id: 'dyn-layer',
      enabled: false,
      onDismiss
    });

    expect(getLayerStack().length).toBe(0);

    // Escape while disabled has no effect
    const escape1 = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    document.dispatchEvent(escape1);
    expect(onDismiss).not.toHaveBeenCalled();

    // Enable via update
    layer.update?.({
      id: 'dyn-layer',
      enabled: true,
      onDismiss
    });

    expect(getLayerStack().length).toBe(1);
    expect(getTopLayer()?.id).toBe('dyn-layer');

    // Now Escape triggers dismissal
    const escape2 = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    document.dispatchEvent(escape2);
    expect(onDismiss).toHaveBeenCalledWith('escape');

    layer.destroy?.();
  });

  it('prevents cascading dismissal when Escape key is held down (ignoreRepeat)', () => {
    const layer1Node = document.createElement('div');
    const layer2Node = document.createElement('div');
    document.body.appendChild(layer1Node);
    document.body.appendChild(layer2Node);

    const onDismiss1 = vi.fn();
    const onDismiss2 = vi.fn();

    const layer1 = nuiLayer(layer1Node, { id: 'layer-bottom', onDismiss: onDismiss1 });
    const layer2 = nuiLayer(layer2Node, { id: 'layer-top', onDismiss: onDismiss2 });

    expect(getTopLayer()?.id).toBe('layer-top');

    // Initial Escape keydown (repeat: false) -> dismisses topmost layer (layer2)
    const initialEscape = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true
    });
    vi.spyOn(initialEscape, 'preventDefault');
    document.dispatchEvent(initialEscape);

    expect(onDismiss2).toHaveBeenCalledTimes(1);
    expect(onDismiss1).not.toHaveBeenCalled();
    expect(initialEscape.preventDefault).toHaveBeenCalled();

    // In a real app, layer2 would now be destroyed/unmounted:
    layer2.destroy?.();
    expect(getTopLayer()?.id).toBe('layer-bottom');

    // Repeated Escape keydown from holding key down (repeat: true)
    const repeatEscape = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true
    });
    Object.defineProperty(repeatEscape, 'repeat', { value: true });
    vi.spyOn(repeatEscape, 'preventDefault');
    document.dispatchEvent(repeatEscape);

    // Layer 1 should NOT be dismissed because repeat is ignored!
    expect(onDismiss1).not.toHaveBeenCalled();
    // But preventDefault is still called to prevent browser/CEF default action
    expect(repeatEscape.preventDefault).toHaveBeenCalled();

    layer1.destroy?.();
    layer1Node.remove();
    layer2Node.remove();
  });

  it('respects onEscape: false and onClickOutside: false flags', () => {
    container.innerHTML = `<button id="btn">Modal button</button>`;
    const onDismiss = vi.fn();

    const layer = nuiLayer(container, {
      id: 'no-escape-layer',
      onEscape: false,
      onClickOutside: false,
      onDismiss
    });

    // Escape should not trigger dismiss
    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    document.dispatchEvent(escapeEvent);
    expect(onDismiss).not.toHaveBeenCalled();

    // Click outside should not trigger dismiss
    const outsideEvent = new PointerEvent('pointerdown', { bubbles: true, button: 0 });
    document.body.dispatchEvent(outsideEvent);
    expect(onDismiss).not.toHaveBeenCalled();

    layer.destroy?.();
  });

  it('dynamically updates focus trap config when options change while active', async () => {
    container.innerHTML = `
      <button id="btn1">Button 1</button>
      <button id="btn2">Button 2</button>
    `;

    const layer = nuiLayer(container, {
      id: 'sync-layer',
      enabled: true,
      initialFocus: '#btn1'
    });
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(document.activeElement?.id).toBe('btn1');

    // Update with new initialFocus and autofocus while remaining active
    layer.update?.({
      id: 'sync-layer',
      enabled: true,
      initialFocus: '#btn2',
      autofocus: true
    });

    layer.destroy?.();
  });

  it('triggers custom onClickOutside callback instead of onDismiss when provided', () => {
    container.innerHTML = `<button id="btn">Modal button</button>`;
    const onClickOutside = vi.fn();
    const onDismiss = vi.fn();

    const layer = nuiLayer(container, {
      id: 'custom-outside-layer',
      onClickOutside,
      onDismiss
    });

    const outsideEvent = new PointerEvent('pointerdown', { bubbles: true, button: 0 });
    document.body.dispatchEvent(outsideEvent);

    expect(onClickOutside).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();

    layer.destroy?.();
  });

  it('destroys inner focusTrap and deactivates layer when updated dynamically', () => {
    container.innerHTML = `<button id="btn">Modal button</button>`;
    const layer = nuiLayer(container, {
      id: 'toggle-layer',
      enabled: true,
      trapFocus: true
    });

    expect(getTopLayer()?.id).toBe('toggle-layer');

    // Update trapFocus: false -> destroys focus trap
    layer.update?.({
      id: 'toggle-layer',
      enabled: true,
      trapFocus: false
    });

    // Update enabled: false -> deactivates layer
    layer.update?.({
      id: 'toggle-layer',
      enabled: false
    });
    layer.destroy?.();
  });

  it('calls event.stopPropagation on Escape when stopEscapePropagation is true', () => {
    container.innerHTML = `<button id="btn">Modal button</button>`;
    const onDismiss = vi.fn();

    const layer = nuiLayer(container, {
      id: 'stop-prop-layer',
      stopEscapePropagation: true,
      onDismiss
    });

    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    vi.spyOn(escapeEvent, 'stopPropagation');
    document.dispatchEvent(escapeEvent);

    expect(escapeEvent.stopPropagation).toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalledWith('escape');

    layer.destroy?.();
  });

  it('synchronizes inner focusTrap with layer priority', async () => {
    const layer1Node = document.createElement('div');
    layer1Node.innerHTML = `<button id="btnPriority10">P10</button>`;
    const layer2Node = document.createElement('div');
    layer2Node.innerHTML = `<button id="btnPriority0">P0</button>`;
    document.body.appendChild(layer1Node);
    document.body.appendChild(layer2Node);

    // Layer 1 activated first with priority 10
    const layer1 = nuiLayer(layer1Node, {
      id: 'layer-p10',
      priority: 10
    });

    // Layer 2 activated later with priority 0
    const layer2 = nuiLayer(layer2Node, {
      id: 'layer-p0',
      priority: 0
    });
    await new Promise((resolve) => requestAnimationFrame(resolve));

    // Top layer according to stack is layer 1
    expect(getTopLayer()?.id).toBe('layer-p10');

    // Focus inside layer 1 should be preserved
    const p10Btn = layer1Node.querySelector<HTMLElement>('#btnPriority10')!;
    expect(document.activeElement).toBe(p10Btn);

    layer1.destroy?.();
    layer2.destroy?.();
    layer1Node.remove();
    layer2Node.remove();
  });

  it('skips disconnected nodes when evaluating getTopLayer and onGlobalPointerDown', () => {
    const layer1Node = document.createElement('div');
    const layer2Node = document.createElement('div');
    document.body.appendChild(layer1Node);
    document.body.appendChild(layer2Node);

    const onDismiss1 = vi.fn();
    const onDismiss2 = vi.fn();

    const layer1 = nuiLayer(layer1Node, { id: 'layer-active', onDismiss: onDismiss1 });
    const layer2 = nuiLayer(layer2Node, { id: 'layer-disconnected', onDismiss: onDismiss2 });

    // Disconnect layer 2 node from DOM without destroying action yet
    layer2Node.remove();

    // getTopLayer should skip disconnected layer 2 and return connected layer 1
    expect(getTopLayer()?.id).toBe('layer-active');

    // Outside pointerdown should dismiss layer 1 (not blocked by disconnected layer 2)
    const outsideEvent = new PointerEvent('pointerdown', { bubbles: true, button: 0 });
    document.body.dispatchEvent(outsideEvent);

    expect(onDismiss1).toHaveBeenCalledWith('outside');
    expect(onDismiss2).not.toHaveBeenCalled();

    layer1.destroy?.();
    layer2.destroy?.();
    layer1Node.remove();
  });

  it('handles layer combined with standalone trap where layer-coordinated trap takes focus precedence', async () => {
    const standaloneNode = document.createElement('div');
    standaloneNode.innerHTML = `<button id="standaloneBtn">Standalone</button>`;
    const layerNode = document.createElement('div');
    layerNode.innerHTML = `<button id="layerBtn">Layer</button>`;
    document.body.appendChild(standaloneNode);
    document.body.appendChild(layerNode);

    const standaloneTrap = nuiFocusTrap(standaloneNode, true);
    const layerAction = nuiLayer(layerNode, { priority: 10, trapFocus: true });
    await waitForFrame();

    // Layer-coordinated trap is topmost because isTopmost evaluates to true
    expect(getTopTrap()?.node).toBe(layerNode);

    // Focus lands on the layer button
    expect(document.activeElement?.id).toBe('layerBtn');

    // Focusin on body is intercepted by the layer trap
    const outsideEvent = new FocusEvent('focusin', { bubbles: true });
    Object.defineProperty(outsideEvent, 'target', { value: document.body });
    document.dispatchEvent(outsideEvent);
    expect(document.activeElement?.id).toBe('layerBtn');

    standaloneTrap.destroy?.();
    layerAction.destroy?.();
    standaloneNode.remove();
    layerNode.remove();
  });

  it('passes Escape, pointerdown outside, and Tab focusin down to active layer when top layer is disconnected without destroy', async () => {
    const layer1Node = document.createElement('div');
    layer1Node.innerHTML = `<button id="btn1">Button 1</button>`;
    const layer2Node = document.createElement('div');
    layer2Node.innerHTML = `<button id="btn2">Button 2</button>`;
    document.body.appendChild(layer1Node);
    document.body.appendChild(layer2Node);

    const onDismiss1 = vi.fn();
    const onDismiss2 = vi.fn();

    const layer1 = nuiLayer(layer1Node, { id: 'l1', priority: 0, onDismiss: onDismiss1 });
    const layer2 = nuiLayer(layer2Node, { id: 'l2', priority: 10, onDismiss: onDismiss2 });
    await waitForFrame();

    // Disconnect layer 2 from DOM without calling destroy()
    layer2Node.remove();

    // 1. Escape key
    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.dispatchEvent(escapeEvent);
    expect(onDismiss2).not.toHaveBeenCalled();
    expect(onDismiss1).toHaveBeenCalledWith('escape');

    // 2. Outside pointerdown
    const outsidePointer = new PointerEvent('pointerdown', { bubbles: true, button: 0 });
    document.body.dispatchEvent(outsidePointer);
    expect(onDismiss2).not.toHaveBeenCalled();
    expect(onDismiss1).toHaveBeenCalledWith('outside');

    // 3. Tab focusin redirection
    const focusInEvent = new FocusEvent('focusin', { bubbles: true });
    Object.defineProperty(focusInEvent, 'target', { value: document.body });
    document.dispatchEvent(focusInEvent);
    expect(document.activeElement?.id).toBe('btn1');

    layer1.destroy?.();
    layer2.destroy?.();
    layer1Node.remove();
  });

  it('ignores repeated Escape keydown (holding key) and dismisses exactly one layer upon a fresh press', () => {
    const layer1Node = document.createElement('div');
    const layer2Node = document.createElement('div');
    document.body.appendChild(layer1Node);
    document.body.appendChild(layer2Node);

    const onDismiss1 = vi.fn();
    const onDismiss2 = vi.fn();

    const layer1 = nuiLayer(layer1Node, { id: 'layer1', priority: 0, onDismiss: onDismiss1 });
    const layer2 = nuiLayer(layer2Node, { id: 'layer2', priority: 10, onDismiss: onDismiss2 });

    // 1. Holding Escape key generates events with repeat: true
    const repeatEscape = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
      repeat: true
    });
    document.dispatchEvent(repeatEscape);

    expect(onDismiss1).not.toHaveBeenCalled();
    expect(onDismiss2).not.toHaveBeenCalled();

    // 2. Fresh Escape press with repeat: false
    const freshEscape = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
      repeat: false
    });
    document.dispatchEvent(freshEscape);

    // Only topmost layer dismisses
    expect(onDismiss2).toHaveBeenCalledTimes(1);
    expect(onDismiss2).toHaveBeenCalledWith('escape');
    expect(onDismiss1).not.toHaveBeenCalled();

    layer1.destroy?.();
    layer2.destroy?.();
    layer1Node.remove();
    layer2Node.remove();
  });

  it('focuses child element on rAF without setting temporary tabindex on container when children mount in same tick', async () => {
    const modalContainer = document.createElement('div');
    document.body.appendChild(modalContainer);

    // Mount trap on empty container (as happens in Svelte use: action before child template mounts)
    const trap = nuiFocusTrap(modalContainer, true);

    // In the same tick, children are inserted into the DOM
    modalContainer.innerHTML = `
      <input type="text" id="lateInput" placeholder="Name" />
      <button id="lateSubmit">Submit</button>
    `;

    // Wait for the animation frame
    await waitForFrame();

    // The child element receives focus
    expect(document.activeElement?.id).toBe('lateInput');

    // The container does NOT keep or have tabindex="-1"
    expect(modalContainer.hasAttribute('tabindex')).toBe(false);

    trap.destroy?.();
    modalContainer.remove();
  });
});
