import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, unmount, flushSync, tick } from "svelte";
import NuiDialog from "../../src/components/overlay/NuiDialog.svelte";

describe("NuiDialog - Confirmation and Action Dialog wrapper", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    document.body.innerHTML = "";
    document.body.className = "";
    vi.restoreAllMocks();
  });

  it("renders title, message, and action buttons", async () => {
    const inst = mount(NuiDialog, {
      target: container,
      props: {
        open: true,
        title: "Delete Vehicle",
        message: "Are you sure you want to delete this vehicle from your garage?",
        actions: [
          { id: "cancel", label: "Cancel", variant: "secondary" },
          { id: "delete", label: "Delete", variant: "danger" },
        ],
      },
    });

    flushSync();
    await tick();

    const titleEl = document.body.querySelector(".nui-modal__title");
    expect(titleEl?.textContent?.trim()).toBe("Delete Vehicle");

    const descEl = document.body.querySelector(".nui-modal__description");
    expect(descEl?.textContent?.trim()).toContain("Are you sure you want to delete this vehicle");

    const buttons = document.body.querySelectorAll<HTMLButtonElement>(
      ".nui-modal__button",
    );
    expect(buttons).toHaveLength(2);
    expect(buttons[0].textContent?.trim()).toBe("Cancel");
    expect(buttons[1].textContent?.trim()).toBe("Delete");

    unmount(inst);
  });

  it("invokes onAction with selected action id and dispatches eventName to client", async () => {
    const onAction = vi.fn();
    const mockClient = {
      send: vi.fn(),
    } as any;
    let open = true;

    const inst = mount(NuiDialog, {
      target: container,
      props: {
        title: "Confirm Action",
        message: "Proceed?",
        actions: [{ id: "yes", label: "Yes", variant: "primary" }],
        eventName: "dialog:confirmed",
        client: mockClient,
        get open() {
          return open;
        },
        set open(v) {
          open = v;
        },
        onAction,
      },
    });

    flushSync();
    await tick();

    const yesBtn = document.body.querySelector<HTMLButtonElement>(
      '[data-action="yes"]',
    );
    yesBtn?.click();
    flushSync();
    await tick();

    expect(open).toBe(false);
    expect(onAction).toHaveBeenCalledWith("yes");
    expect(mockClient.send).toHaveBeenCalledWith("dialog:confirmed", {
      action: "yes",
    });

    unmount(inst);
  });

  it("invokes onAction with null and dispatches cancelEvent when dismissed via Escape", async () => {
    const onAction = vi.fn();
    const mockClient = {
      send: vi.fn(),
    } as any;
    let open = true;

    const inst = mount(NuiDialog, {
      target: container,
      props: {
        title: "Cancelable Dialog",
        message: "Close via escape",
        dismissible: true,
        cancelEvent: "dialog:cancelled",
        client: mockClient,
        get open() {
          return open;
        },
        set open(v) {
          open = v;
        },
        onAction,
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
    await tick();

    expect(open).toBe(false);
    expect(onAction).toHaveBeenCalledWith(null);
    expect(mockClient.send).toHaveBeenCalledWith("dialog:cancelled", {
      cancelled: true,
    });

    unmount(inst);
  });
});
