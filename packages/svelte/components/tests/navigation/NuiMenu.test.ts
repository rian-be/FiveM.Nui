import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, unmount, createRawSnippet, type ComponentProps } from "svelte";
import { flushSync, bindState } from "../helpers/testHelper.svelte";
import NuiMenu, { type MenuItem } from "../../src/components/navigation/NuiMenu.svelte";

type MenuProps = ComponentProps<typeof NuiMenu> & Record<string, unknown>;
type MountedComponent = ReturnType<typeof mount>;

describe("NuiMenu - WAI-ARIA and Keyboard Focus Management", () => {
  let container: HTMLElement;
  let mountedApps: MountedComponent[] = [];

  function mountMenu(props: MenuProps) {
    const target = document.createElement("div");
    container.appendChild(target);
    const inst = mount(NuiMenu, {
      target,
      props: props as ComponentProps<typeof NuiMenu>,
    });
    mountedApps.push(inst);
    flushSync();
    const trigger = target.querySelector<HTMLButtonElement>(".nui-menu__trigger")!;
    return { trigger, inst, target };
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    while (mountedApps.length > 0) {
      const app = mountedApps.pop()!;
      unmount(app);
    }
    container.remove();
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  const disabledActionSpy = vi.fn();

  const sampleItems: MenuItem[] = [
    { id: "edit", label: "Edit Item" },
    { id: "duplicate", label: "Duplicate" },
    { id: "sep-1", separator: true },
    {
      id: "more",
      label: "More Options",
      children: [
        { id: "export", label: "Export Data" },
        { id: "archive", label: "Archive" },
      ],
    },
    { id: "delete", label: "Delete Item", disabled: true, onclick: disabledActionSpy },
  ];

  it("renders trigger button and toggles dropdown on click with ARIA linkage", () => {
    const { trigger, target } = mountMenu({
      triggerLabel: "Options",
      items: sampleItems,
    });

    expect(trigger).not.toBeNull();
    expect(trigger.textContent).toContain("Options");
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.hasAttribute("aria-controls")).toBe(false);

    // Click to open
    trigger.click();
    flushSync();

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const menuId = trigger.getAttribute("aria-controls");
    expect(menuId).toBeTruthy();

    const dropdown = target.querySelector<HTMLElement>('[role="menu"]')!;
    expect(dropdown).not.toBeNull();
    expect(dropdown.id).toBe(menuId);
    expect(dropdown.getAttribute("aria-labelledby")).toBe(trigger.id);

    // Initial focus lands on the first enabled item
    const firstItem = target.querySelector<HTMLButtonElement>('[data-id="edit"]')!;
    expect(document.activeElement).toBe(firstItem);
    expect(firstItem.textContent).toContain("Edit Item");

    // Click trigger again to close
    trigger.click();
    flushSync();
    expect(target.querySelector('[role="menu"]')).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("opens menu and focuses first item on ArrowDown, or last item on ArrowUp from trigger", () => {
    // 1. ArrowDown on trigger
    const { trigger: trigger1, target: target1 } = mountMenu({
      items: sampleItems,
    });
    trigger1.focus();
    trigger1.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    flushSync();

    expect(trigger1.getAttribute("aria-expanded")).toBe("true");
    const firstItem = target1.querySelector<HTMLButtonElement>('[data-id="edit"]')!;
    expect(document.activeElement).toBe(firstItem);
    expect(firstItem.textContent).toContain("Edit Item");

    // 2. ArrowUp on trigger
    const { trigger: trigger2, target: target2 } = mountMenu({
      items: sampleItems,
    });
    trigger2.focus();
    trigger2.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    flushSync();

    expect(trigger2.getAttribute("aria-expanded")).toBe("true");
    // "delete" is disabled, so last enabled item is "more"
    const moreItem = target2.querySelector<HTMLButtonElement>('[data-id="more"]')!;
    expect(document.activeElement).toBe(moreItem);
  });

  it("closes menu and restores focus to trigger upon Escape from within menu", () => {
    const { trigger, target } = mountMenu({
      items: sampleItems,
    });

    trigger.click();
    flushSync();

    const firstItem = target.querySelector<HTMLButtonElement>('[data-id="edit"]')!;
    expect(document.activeElement).toBe(firstItem);

    // Dispatch Escape on the currently focused menu item
    firstItem.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    flushSync();

    expect(target.querySelector('[role="menu"]')).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });

  it("guarantees menu closure and focus restoration even if item onclick throws", () => {
    const errors: Error[] = [];
    const errorHandler = (e: ErrorEvent) => {
      e.preventDefault();
      errors.push(e.error);
    };
    window.addEventListener("error", errorHandler);

    const throwingClick = vi.fn().mockImplementation(() => {
      throw new Error("Item action failed!");
    });

    const items: MenuItem[] = [
      { id: "fail", label: "Crash Action", onclick: throwingClick },
    ];

    try {
      const { trigger, target } = mountMenu({ items });

      trigger.click();
      flushSync();

      const itemBtn = target.querySelector<HTMLButtonElement>('[data-id="fail"]')!;
      expect(document.activeElement).toBe(itemBtn);

      let synchronousError: unknown = null;
      try {
        itemBtn.click();
      } catch (err) {
        synchronousError = err;
      }
      flushSync();

      expect(throwingClick).toHaveBeenCalledTimes(1);
      const reportedError = synchronousError ?? errors[0];
      expect(reportedError).toBeTruthy();
      expect((reportedError as Error).message).toBe("Item action failed!");
      // Menu is guaranteed closed by finally block
      expect(target.querySelector('[role="menu"]')).toBeNull();
      // Focus is restored to trigger by finally block
      expect(document.activeElement).toBe(trigger);
    } finally {
      window.removeEventListener("error", errorHandler);
    }
  });

  const arrowNavigationCases = [
    {
      name: "ArrowDown moves focus to next enabled item",
      startId: "edit",
      key: "ArrowDown",
      expectedId: "duplicate",
    },
    {
      name: "ArrowDown wraps around from last enabled item to first (skipping disabled delete)",
      startId: "more",
      key: "ArrowDown",
      expectedId: "edit",
    },
    {
      name: "ArrowUp moves focus to previous enabled item",
      startId: "duplicate",
      key: "ArrowUp",
      expectedId: "edit",
    },
    {
      name: "ArrowUp wraps around from first item to last enabled item (skipping disabled delete)",
      startId: "edit",
      key: "ArrowUp",
      expectedId: "more",
    },
    {
      name: "Home moves focus to first enabled item",
      startId: "more",
      key: "Home",
      expectedId: "edit",
    },
    {
      name: "End moves focus to last enabled item (skipping disabled delete)",
      startId: "edit",
      key: "End",
      expectedId: "more",
    },
  ];

  it.each(arrowNavigationCases)(
    "$name",
    ({ startId, key, expectedId }) => {
      const { trigger, target } = mountMenu({ items: sampleItems });
      trigger.click();
      flushSync();

      const startItem = target.querySelector<HTMLButtonElement>(`[data-id="${startId}"]`)!;
      startItem.focus();
      expect(document.activeElement).toBe(startItem);

      startItem.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
      flushSync();

      const expectedItem = target.querySelector<HTMLButtonElement>(`[data-id="${expectedId}"]`)!;
      expect(document.activeElement).toBe(expectedItem);
    },
  );

  it("handles ArrowRight to open submenu, moves focus, and ArrowLeft to close and restore focus", () => {
    const { trigger, target } = mountMenu({ items: sampleItems });
    trigger.click();
    flushSync();

    const submenuTrigger = target.querySelector<HTMLButtonElement>('[data-id="more"]')!;
    submenuTrigger.focus();
    expect(submenuTrigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(submenuTrigger.getAttribute("aria-expanded")).toBe("false");

    // Press ArrowRight on submenu trigger to open submenu
    submenuTrigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    flushSync();

    expect(submenuTrigger.getAttribute("aria-expanded")).toBe("true");
    const subPanel = target.querySelector<HTMLElement>('[data-submenu-panel="more"]')!;
    expect(subPanel).not.toBeNull();
    expect(subPanel.getAttribute("role")).toBe("menu");
    expect(subPanel.getAttribute("aria-label")).toBe("More Options");

    // Focus automatically moves to the first item of the submenu ('export')
    const firstSubItem = subPanel.querySelector<HTMLButtonElement>('[data-id="export"]')!;
    expect(document.activeElement).toBe(firstSubItem);
    expect(firstSubItem.textContent).toContain("Export Data");

    // Press ArrowLeft on first submenu item to close submenu and return focus to parent item
    firstSubItem.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    flushSync();

    expect(target.querySelector('[data-submenu-panel="more"]')).toBeNull();
    expect(submenuTrigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(submenuTrigger);
  });

  it("closes only the submenu when Escape is pressed inside submenu panel", () => {
    const { trigger, target } = mountMenu({ items: sampleItems });
    trigger.click();
    flushSync();

    const submenuTrigger = target.querySelector<HTMLButtonElement>('[data-id="more"]')!;
    submenuTrigger.focus();
    submenuTrigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    flushSync();

    const subPanel = target.querySelector<HTMLElement>('[data-submenu-panel="more"]')!;
    const firstSubItem = subPanel.querySelector<HTMLButtonElement>('[data-id="export"]')!;
    expect(document.activeElement).toBe(firstSubItem);

    // Escape inside submenu
    firstSubItem.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    flushSync();

    // Submenu panel is closed, but main menu remains open!
    expect(target.querySelector('[data-submenu-panel="more"]')).toBeNull();
    expect(target.querySelector('[role="menu"]')).not.toBeNull();
    expect(document.activeElement).toBe(submenuTrigger);
  });

  it("does nothing on ArrowRight when item has no children", () => {
    const { trigger, target } = mountMenu({ items: sampleItems });
    trigger.click();
    flushSync();

    const editItem = target.querySelector<HTMLButtonElement>('[data-id="edit"]')!;
    editItem.focus();

    editItem.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    flushSync();

    expect(target.querySelectorAll('[role="menu"]')).toHaveLength(1);
    expect(document.activeElement).toBe(editItem);
  });

  it("does nothing on ArrowRight when submenu item is disabled", () => {
    const itemsWithDisabledSubmenu: MenuItem[] = [
      {
        id: "disabled-sub",
        label: "Locked Options",
        disabled: true,
        children: [{ id: "sub-1", label: "Secret" }],
      },
    ];
    const { trigger, target } = mountMenu({ items: itemsWithDisabledSubmenu });
    trigger.click();
    flushSync();

    const disabledSubTrigger = target.querySelector<HTMLButtonElement>('[data-id="disabled-sub"]')!;
    disabledSubTrigger.focus();

    disabledSubTrigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    flushSync();

    expect(target.querySelector('[data-submenu-panel="disabled-sub"]')).toBeNull();
    expect(disabledSubTrigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("does nothing when ArrowLeft is pressed on a top-level menu item in start align mode", () => {
    const { trigger, target } = mountMenu({ items: sampleItems });
    trigger.click();
    flushSync();

    const duplicateItem = target.querySelector<HTMLButtonElement>('[data-id="duplicate"]')!;
    duplicateItem.focus();

    duplicateItem.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    flushSync();

    expect(document.activeElement).toBe(duplicateItem);
    expect(target.querySelector('[role="menu"]')).not.toBeNull();
  });

  it("inverts submenu open/close keys when align is 'end' (ArrowLeft opens, ArrowRight closes)", () => {
    const { trigger, target } = mountMenu({ items: sampleItems, align: "end" });
    trigger.click();
    flushSync();

    const submenuTrigger = target.querySelector<HTMLButtonElement>('[data-id="more"]')!;
    submenuTrigger.focus();

    // In end-align mode, submenus open to the left with ArrowLeft
    submenuTrigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    flushSync();

    expect(submenuTrigger.getAttribute("aria-expanded")).toBe("true");
    const subPanel = target.querySelector<HTMLElement>('[data-submenu-panel="more"]')!;
    expect(subPanel).not.toBeNull();

    const firstSubItem = subPanel.querySelector<HTMLButtonElement>('[data-id="export"]')!;
    expect(document.activeElement).toBe(firstSubItem);

    // In end-align mode, ArrowRight closes the submenu and returns focus to parent
    firstSubItem.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    flushSync();

    expect(target.querySelector('[data-submenu-panel="more"]')).toBeNull();
    expect(document.activeElement).toBe(submenuTrigger);
  });

  it("renders separator and skips it during ArrowDown keyboard navigation", () => {
    const { trigger, target } = mountMenu({ items: sampleItems });
    trigger.click();
    flushSync();

    const separator = target.querySelector<HTMLElement>('[role="separator"]')!;
    expect(separator).not.toBeNull();
    expect(separator.classList.contains("nui-menu__separator")).toBe(true);
    expect(separator.hasAttribute("tabindex")).toBe(false);

    // Navigate from duplicate (item right before separator)
    const duplicateItem = target.querySelector<HTMLButtonElement>('[data-id="duplicate"]')!;
    duplicateItem.focus();

    duplicateItem.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    flushSync();

    // Focus skips separator and lands directly on 'more'
    const moreItem = target.querySelector<HTMLButtonElement>('[data-id="more"]')!;
    expect(document.activeElement).toBe(moreItem);
  });

  it("renders disabled item with aria-disabled, unclickable and does not execute onclick or close menu", () => {
    disabledActionSpy.mockClear();
    const { trigger, target } = mountMenu({ items: sampleItems });
    trigger.click();
    flushSync();

    const deleteBtn = target.querySelector<HTMLButtonElement>('[data-id="delete"]')!;
    expect(deleteBtn).not.toBeNull();
    expect(deleteBtn.getAttribute("aria-disabled")).toBe("true");
    expect(deleteBtn.textContent).toContain("Delete Item");

    deleteBtn.focus();
    expect(document.activeElement).toBe(deleteBtn);

    deleteBtn.click();
    flushSync();

    expect(disabledActionSpy).not.toHaveBeenCalled();
    // Focus remains in place and menu stays open
    expect(document.activeElement).toBe(deleteBtn);
    expect(target.querySelector('[role="menu"]')).not.toBeNull();
  });

  it("executes item onclick exactly once, closes menu and restores focus to trigger", () => {
    const clickSpy = vi.fn();
    const items: MenuItem[] = [
      { id: "action", label: "Perform Action", onclick: clickSpy },
    ];
    const { trigger, target } = mountMenu({ items });

    trigger.click();
    flushSync();

    const itemBtn = target.querySelector<HTMLButtonElement>('[data-id="action"]')!;
    itemBtn.click();
    flushSync();

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(target.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("executes submenu item onclick and closes the entire menu", () => {
    const subActionSpy = vi.fn();
    const itemsWithAction: MenuItem[] = [
      {
        id: "parent",
        label: "Parent",
        children: [{ id: "sub-action", label: "Sub Action", onclick: subActionSpy }],
      },
    ];
    const { trigger, target } = mountMenu({ items: itemsWithAction });
    trigger.click();
    flushSync();

    const parentBtn = target.querySelector<HTMLButtonElement>('[data-id="parent"]')!;
    parentBtn.focus();
    parentBtn.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    flushSync();

    const subItemBtn = target.querySelector<HTMLButtonElement>('[data-id="sub-action"]')!;
    subItemBtn.click();
    flushSync();

    expect(subActionSpy).toHaveBeenCalledTimes(1);
    expect(target.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("activates item on Enter or Space key and closes menu with focus restored", () => {
    // Note: In WAI-ARIA button specifications, standard keyboard activation via Enter/Space
    // triggers a synthetic click event (with detail: 0). In jsdom/happy-dom environments,
    // keydown events do not synthesize click events automatically, so triggering click with
    // detail: 0 directly tests the component's keyboard activation pathway.
    const enterClickSpy = vi.fn();
    const items: MenuItem[] = [
      { id: "enter-action", label: "Enter Action", onclick: enterClickSpy },
    ];
    const { trigger, target } = mountMenu({ items });
    trigger.click();
    flushSync();

    const itemBtn = target.querySelector<HTMLButtonElement>('[data-id="enter-action"]')!;
    itemBtn.focus();

    itemBtn.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }));
    flushSync();

    expect(enterClickSpy).toHaveBeenCalledTimes(1);
    expect(target.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("toggles submenu via Enter / Space keyboard click", () => {
    const { trigger, target } = mountMenu({ items: sampleItems });
    trigger.click();
    flushSync();

    const submenuBtn = target.querySelector<HTMLButtonElement>('[data-id="more"]')!;
    // detail: 0 represents keyboard invocation
    submenuBtn.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }));
    flushSync();

    expect(submenuBtn.getAttribute("aria-expanded")).toBe("true");
    expect(target.querySelector('[data-submenu-panel="more"]')).not.toBeNull();

    // Second Enter closes it
    submenuBtn.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }));
    flushSync();

    expect(submenuBtn.getAttribute("aria-expanded")).toBe("false");
    expect(target.querySelector('[data-submenu-panel="more"]')).toBeNull();
  });

  it("handles mouse hover to open and close submenu, ignoring touch events", () => {
    const { trigger, target } = mountMenu({ items: sampleItems });
    trigger.click();
    flushSync();

    const submenuWrapper = target.querySelector<HTMLElement>(".nui-menu__submenu")!;

    // 1. Touch pointerenter does NOT open submenu
    submenuWrapper.dispatchEvent(
      new PointerEvent("pointerenter", { bubbles: true, pointerType: "touch" }),
    );
    flushSync();
    expect(target.querySelector('[data-submenu-panel="more"]')).toBeNull();

    // 2. Mouse pointerenter opens submenu
    submenuWrapper.dispatchEvent(
      new PointerEvent("pointerenter", { bubbles: true, pointerType: "mouse" }),
    );
    flushSync();
    expect(target.querySelector('[data-submenu-panel="more"]')).not.toBeNull();

    // 3. Mouse pointerleave closes submenu when focus is not inside
    submenuWrapper.dispatchEvent(
      new PointerEvent("pointerleave", { bubbles: true, pointerType: "mouse" }),
    );
    flushSync();
    expect(target.querySelector('[data-submenu-panel="more"]')).toBeNull();
  });

  it("does not dismiss submenu on mouse leave when keyboard focus is inside submenu panel", () => {
    const { trigger, target } = mountMenu({ items: sampleItems });
    trigger.click();
    flushSync();

    const submenuWrapper = target.querySelector<HTMLElement>(".nui-menu__submenu")!;
    const submenuTrigger = target.querySelector<HTMLButtonElement>('[data-id="more"]')!;
    submenuTrigger.focus();
    submenuTrigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    flushSync();

    const subPanel = target.querySelector<HTMLElement>('[data-submenu-panel="more"]')!;
    const firstSubItem = subPanel.querySelector<HTMLButtonElement>('[data-id="export"]')!;
    expect(document.activeElement).toBe(firstSubItem);

    // Mouse leaves submenu wrapper
    submenuWrapper.dispatchEvent(
      new PointerEvent("pointerleave", { bubbles: true, pointerType: "mouse" }),
    );
    flushSync();

    // Submenu is NOT dismissed because focus is actively inside it!
    expect(target.querySelector('[data-submenu-panel="more"]')).not.toBeNull();
  });

  it("closes menu and restores focus when Tab key is pressed inside menu", () => {
    const { trigger, target } = mountMenu({ items: sampleItems });
    trigger.click();
    flushSync();

    const firstItem = target.querySelector<HTMLButtonElement>('[data-id="edit"]')!;
    firstItem.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    flushSync();

    expect(target.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("matches items in type-ahead even when item has an icon prefix", () => {
    const iconItems: MenuItem[] = [
      { id: "edit-icon", label: "Edit", icon: "✎" },
      { id: "camera-icon", label: "Camera", icon: "📷" },
    ];
    const { trigger, target } = mountMenu({ items: iconItems });
    trigger.click();
    flushSync();

    const firstItem = target.querySelector<HTMLButtonElement>('[data-id="edit-icon"]')!;
    firstItem.focus();

    // Press 'c' -> matches Camera by data-label, ignoring the '📷' icon
    firstItem.dispatchEvent(new KeyboardEvent("keydown", { key: "c", bubbles: true }));
    flushSync();

    const cameraItem = target.querySelector<HTMLButtonElement>('[data-id="camera-icon"]')!;
    expect(document.activeElement).toBe(cameraItem);
  });

  it("handles multi-character type-ahead and buffer reset after 500ms", () => {
    vi.useFakeTimers();
    try {
      const { trigger, target } = mountMenu({ items: sampleItems });
      trigger.click();
      flushSync();

      const editItem = target.querySelector<HTMLButtonElement>('[data-id="edit"]')!;
      editItem.focus();

      // 1. Fast typing 'd' then 'u' -> matches 'duplicate'
      editItem.dispatchEvent(new KeyboardEvent("keydown", { key: "d", bubbles: true }));
      editItem.dispatchEvent(new KeyboardEvent("keydown", { key: "u", bubbles: true }));
      flushSync();

      const duplicateItem = target.querySelector<HTMLButtonElement>('[data-id="duplicate"]')!;
      expect(document.activeElement).toBe(duplicateItem);

      // 2. Wait 600ms -> buffer resets
      vi.advanceTimersByTime(600);

      // 3. Pressing 'e' matches 'edit'
      duplicateItem.dispatchEvent(new KeyboardEvent("keydown", { key: "e", bubbles: true }));
      flushSync();
      expect(document.activeElement).toBe(editItem);

      // 4. Repeated consecutive single key ('e', 'e') cycles through matches
      editItem.dispatchEvent(new KeyboardEvent("keydown", { key: "e", bubbles: true }));
      flushSync();
      expect(document.activeElement).toBe(editItem);
    } finally {
      vi.useRealTimers();
    }
  });

  it("closes on outside click when closeOnOutsideClick is true without stealing focus", () => {
    const { trigger, target } = mountMenu({
      items: sampleItems,
      closeOnOutsideClick: true,
    });

    trigger.click();
    flushSync();

    expect(target.querySelector('[role="menu"]')).not.toBeNull();
    const firstItem = target.querySelector<HTMLButtonElement>('[data-id="edit"]')!;
    expect(document.activeElement).toBe(firstItem);

    // Create an outside button to simulate clicking another element on the page
    const outsideBtn = document.createElement("button");
    document.body.appendChild(outsideBtn);

    // Dispatch pointerdown directly on outsideBtn without pre-focusing it
    outsideBtn.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    flushSync();

    expect(target.querySelector('[role="menu"]')).toBeNull();
    // Does not steal focus back to trigger
    expect(document.activeElement).not.toBe(trigger);
  });

  it("keeps menu open on outside click when closeOnOutsideClick is false", () => {
    const { trigger, target } = mountMenu({
      items: sampleItems,
      closeOnOutsideClick: false,
    });

    trigger.click();
    flushSync();

    const outsideBtn = document.createElement("button");
    document.body.appendChild(outsideBtn);

    outsideBtn.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    flushSync();

    expect(target.querySelector('[role="menu"]')).not.toBeNull();
  });

  it("closes menu when focus moves outside via focusout", () => {
    const { trigger, target } = mountMenu({ items: sampleItems });
    trigger.click();
    flushSync();

    expect(target.querySelector('[role="menu"]')).not.toBeNull();

    const outsideBtn = document.createElement("button");
    document.body.appendChild(outsideBtn);

    const firstItem = target.querySelector<HTMLButtonElement>('[data-id="edit"]')!;
    firstItem.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: outsideBtn }));
    flushSync();

    expect(target.querySelector('[role="menu"]')).toBeNull();
  });

  it("does nothing when Escape is pressed on trigger while menu is closed", () => {
    const { trigger, target } = mountMenu({ items: sampleItems });
    trigger.focus();

    trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    flushSync();

    expect(target.querySelector('[role="menu"]')).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });

  it("applies align end class when align prop is set to end", () => {
    const { target } = mountMenu({
      items: sampleItems,
      align: "end",
    });

    const menuRoot = target.querySelector(".nui-menu")!;
    expect(menuRoot.classList.contains("nui-menu--end")).toBe(true);
  });

  it("supports controlled open state via two-way binding", () => {
    const menuOpen = bindState(false);
    const { trigger, target } = mountMenu({
      items: sampleItems,
      get open() {
        return menuOpen.current;
      },
      set open(v) {
        menuOpen.current = v;
      },
    });

    expect(target.querySelector('[role="menu"]')).toBeNull();

    // Open from parent
    menuOpen.current = true;
    flushSync();

    expect(target.querySelector('[role="menu"]')).not.toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    // Close from parent
    menuOpen.current = false;
    flushSync();

    expect(target.querySelector('[role="menu"]')).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("renders custom trigger snippet when provided", () => {
    const customTrigger = createRawSnippet(() => ({
      render: () => '<span class="custom-trigger-badge">Custom</span>',
    }));

    const { trigger } = mountMenu({
      items: sampleItems,
      trigger: customTrigger,
    });

    expect(trigger.querySelector(".custom-trigger-badge")).not.toBeNull();
    expect(trigger.querySelector(".custom-trigger-badge")!.textContent).toBe("Custom");
  });

  it("ensures unique DOM IDs between multiple NuiMenu instances", () => {
    const { trigger: trigger1 } = mountMenu({ items: sampleItems });
    const { trigger: trigger2 } = mountMenu({ items: sampleItems });

    expect(trigger1.id).toBeTruthy();
    expect(trigger2.id).toBeTruthy();
    expect(trigger1.id).not.toBe(trigger2.id);
  });

  it("renders safely without errors when items list is empty", () => {
    const { trigger, target } = mountMenu({ items: [] });
    expect(trigger).not.toBeNull();

    trigger.click();
    flushSync();

    expect(target.querySelector('[role="menu"]')).not.toBeNull();
    expect(target.querySelectorAll('[role="menuitem"]')).toHaveLength(0);
  });
});
