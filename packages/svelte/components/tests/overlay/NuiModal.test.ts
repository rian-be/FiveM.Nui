import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, unmount, tick } from "svelte";
import { flushSync, bindState } from "../helpers/testHelper.svelte";
import NuiModal from "../../src/components/overlay/NuiModal.svelte";

describe("NuiModal - WAI-ARIA Dialog, Isolation, and Focus Management", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    // Clean up any elements portaled to document.body
    document.body.innerHTML = "";
    document.body.className = "";
    vi.restoreAllMocks();
  });

  it("portals backdrop directly to document.body and sets scroll lock class", async () => {
    const modalOpen = bindState(true);
    const inst = mount(NuiModal, {
      target: container,
      props: {
        title: "Test Modal",
        get open() {
          return modalOpen.current;
        },
        set open(v) {
          modalOpen.current = v;
        },
      },
    });

    flushSync();
    await tick();

    const backdrop = document.body.querySelector(".nui-modal-backdrop");
    expect(backdrop).not.toBeNull();
    expect(backdrop?.parentElement).toBe(document.body);
    expect(document.body.classList.contains("nui-scroll-locked")).toBe(true);

    modalOpen.current = false;
    flushSync();
    await tick();

    expect(document.body.classList.contains("nui-scroll-locked")).toBe(false);

    unmount(inst);
  });

  it("sets role='dialog', aria-modal='true', and tabindex='-1' on modal container", async () => {
    const inst = mount(NuiModal, {
      target: container,
      props: {
        open: true,
        title: "Server Settings",
      },
    });

    flushSync();
    await tick();

    const modal = document.body.querySelector(".nui-modal");
    expect(modal).not.toBeNull();
    expect(modal?.getAttribute("role")).toBe("dialog");
    expect(modal?.getAttribute("aria-modal")).toBe("true");
    expect(modal?.getAttribute("tabindex")).toBe("-1");

    // Accessible title association via aria-labelledby
    const titleEl = document.body.querySelector(".nui-modal__title");
    expect(titleEl?.id).toBeTruthy();
    expect(modal?.getAttribute("aria-labelledby")).toBe(titleEl?.id);

    unmount(inst);
  });

  it("handles close button click and triggers onClose", async () => {
    const onClose = vi.fn();
    let open = true;

    const inst = mount(NuiModal, {
      target: container,
      props: {
        title: "Dismissible Modal",
        closable: true,
        get open() {
          return open;
        },
        set open(v) {
          open = v;
        },
        onClose,
      },
    });

    flushSync();
    await tick();

    const closeBtn = document.body.querySelector<HTMLButtonElement>(
      ".nui-modal__close",
    );
    expect(closeBtn).not.toBeNull();
    closeBtn?.click();
    flushSync();

    expect(open).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);

    unmount(inst);
  });

  it("dismisses on Escape key and stops event propagation", async () => {
    const onClose = vi.fn();
    let open = true;

    const inst = mount(NuiModal, {
      target: container,
      props: {
        title: "Escape Modal",
        closable: true,
        get open() {
          return open;
        },
        set open(v) {
          open = v;
        },
        onClose,
      },
    });

    flushSync();
    await tick();

    const escapeEvent = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(escapeEvent);
    flushSync();

    expect(open).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(escapeEvent.defaultPrevented).toBe(true);

    unmount(inst);
  });

  it("executes action onclick and automatically closes when closeOnClick is true", async () => {
    const actionClick = vi.fn();
    const onClose = vi.fn();
    let open = true;

    const inst = mount(NuiModal, {
      target: container,
      props: {
        title: "Action Modal",
        actions: [
          {
            id: "confirm",
            label: "Confirm",
            variant: "primary",
            closeOnClick: true,
            onclick: actionClick,
          },
        ],
        get open() {
          return open;
        },
        set open(v) {
          open = v;
        },
        onClose,
      },
    });

    flushSync();
    await tick();

    const actionBtn = document.body.querySelector<HTMLButtonElement>(
      '[data-action="confirm"]',
    );
    expect(actionBtn).not.toBeNull();

    actionBtn?.click();
    flushSync();
    await tick();

    expect(actionClick).toHaveBeenCalledTimes(1);
    expect(open).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);

    unmount(inst);
  });

  it("isolates sibling elements with inert attribute when open", async () => {
    const backgroundContent = document.createElement("div");
    backgroundContent.id = "app-root";
    backgroundContent.innerHTML = "<button id='bg-btn'>Background Button</button>";
    document.body.appendChild(backgroundContent);

    const modalOpen = bindState(true);
    const inst = mount(NuiModal, {
      target: container,
      props: {
        title: "Isolation Modal",
        get open() {
          return modalOpen.current;
        },
        set open(v) {
          modalOpen.current = v;
        },
      },
    });

    flushSync();
    await tick();

    // Background app-root and container must be inert
    expect(backgroundContent.inert).toBe(true);
    expect(backgroundContent.getAttribute("aria-hidden")).toBe("true");

    modalOpen.current = false;
    flushSync();
    await tick();

    // After closing, inert and aria-hidden are cleaned up
    expect(backgroundContent.inert).toBe(false);
    expect(backgroundContent.hasAttribute("aria-hidden")).toBe(false);

    unmount(inst);
    backgroundContent.remove();
  });
});
