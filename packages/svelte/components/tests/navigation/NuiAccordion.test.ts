import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, unmount, createRawSnippet, type ComponentProps } from "svelte";
import { flushSync, bindState } from "../helpers/testHelper.svelte";
import type { SvelteNuiClient } from "@fivem-nui/svelte";
import NuiAccordion, {
  type AccordionItem,
} from "../../src/components/navigation/NuiAccordion.svelte";

type AccordionProps = ComponentProps<typeof NuiAccordion> & Record<string, unknown>;
type MountedComponent = ReturnType<typeof mount>;

describe("NuiAccordion - WAI-ARIA, Keyboard Navigation, and State Management", () => {
  let container: HTMLElement;
  let mountedApps: MountedComponent[] = [];

  function mountAccordion(props: AccordionProps) {
    const target = document.createElement("div");
    container.appendChild(target);
    const inst = mount(NuiAccordion, {
      target,
      props: props as ComponentProps<typeof NuiAccordion>,
    });
    mountedApps.push(inst);
    flushSync();
    const accordion = target.querySelector<HTMLDivElement>(".nui-accordion")!;
    return { accordion, inst, target };
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

  const sampleItems: AccordionItem[] = [
    { id: "sec-1", title: "General Settings", content: "General options" },
    { id: "sec-2", title: "Audio Settings", content: "Audio options", disabled: true },
    { id: "sec-3", title: "Keybinds", content: "Keybinds options" },
    { id: "sec-4", title: "Graphics", content: "Graphics options" },
  ];

  it("renders with correct WAI-ARIA attributes, hidden panels, and unique IDs across instances", () => {
    const { accordion: acc1 } = mountAccordion({
      items: sampleItems,
      defaultOpenIds: ["sec-1"],
    });

    const headers = acc1.querySelectorAll<HTMLButtonElement>(
      ".nui-accordion__header"
    );
    expect(headers).toHaveLength(4);

    // 1. Open header has aria-expanded="true" and valid aria-controls
    expect(headers[0].getAttribute("aria-expanded")).toBe("true");
    const openPanelId = headers[0].getAttribute("aria-controls")!;
    expect(openPanelId).toBeTruthy();

    const openPanel = document.getElementById(openPanelId);
    expect(openPanel).not.toBeNull();
    expect(openPanel!.getAttribute("role")).toBe("region");
    expect(openPanel!.getAttribute("aria-labelledby")).toBe(headers[0].id);
    expect(openPanel!.hidden).toBe(false);

    // 2. Closed headers have aria-expanded="false" and permanent panel in DOM with hidden attribute
    expect(headers[1].getAttribute("aria-expanded")).toBe("false");
    expect(headers[2].getAttribute("aria-expanded")).toBe("false");
    expect(headers[3].getAttribute("aria-expanded")).toBe("false");

    const closedPanelId = headers[2].getAttribute("aria-controls")!;
    expect(closedPanelId).toBeTruthy();
    const closedPanel = document.getElementById(closedPanelId);
    expect(closedPanel).not.toBeNull();
    expect(closedPanel!.hidden).toBe(true);

    // 3. Multiple accordion instances generate unique header IDs and aria-controls
    const { accordion: acc2 } = mountAccordion({
      items: sampleItems,
      defaultOpenIds: ["sec-1"],
    });
    const acc2Headers = acc2.querySelectorAll<HTMLButtonElement>(
      ".nui-accordion__header"
    );

    expect(acc2Headers[0].id).not.toBe(headers[0].id);
    expect(acc2Headers[0].getAttribute("aria-controls")).not.toBe(openPanelId);
  });

  it("sanitizes IDs containing spaces or special characters", () => {
    const specialItems: AccordionItem[] = [
      { id: "my section:1", title: "Special ID", content: "Content" }
    ];
    const { accordion } = mountAccordion({
      items: specialItems,
      defaultOpenIds: ["my section:1"]
    });

    const header = accordion.querySelector<HTMLButtonElement>(".nui-accordion__header")!;
    expect(header.id).not.toContain(" ");
    expect(header.id).not.toContain(":");

    const panelId = header.getAttribute("aria-controls")!;
    expect(panelId).not.toContain(" ");
    expect(panelId).not.toContain(":");
    expect(document.getElementById(panelId)).not.toBeNull();
  });

  it("handles single-mode toggling with previousId tracking in onToggle and allows collapsing", () => {
    const onToggle = vi.fn();
    const { accordion } = mountAccordion({
      items: sampleItems,
      defaultOpenIds: ["sec-1"],
      multiple: false,
      onToggle,
    });

    const headers = accordion.querySelectorAll<HTMLButtonElement>(
      ".nui-accordion__header"
    );

    // 1. Open sec-3; sec-1 closes
    headers[2].click();
    flushSync();

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith({
      id: "sec-3",
      isOpen: true,
      openIds: ["sec-3"],
      previousId: "sec-1",
    });

    expect(headers[0].getAttribute("aria-expanded")).toBe("false");
    expect(headers[2].getAttribute("aria-expanded")).toBe("true");

    // 2. Collapsible: clicking the open section collapses it
    headers[2].click();
    flushSync();

    expect(onToggle).toHaveBeenCalledTimes(2);
    expect(onToggle).toHaveBeenLastCalledWith({
      id: "sec-3",
      isOpen: false,
      openIds: [],
      previousId: undefined,
    });

    expect(headers[2].getAttribute("aria-expanded")).toBe("false");
  });

  it("handles multiple mode: opens multiple sections simultaneously without previousId", () => {
    const onToggle = vi.fn();
    const { accordion } = mountAccordion({
      items: sampleItems,
      defaultOpenIds: ["sec-1"],
      multiple: true,
      onToggle,
    });

    const headers = accordion.querySelectorAll<HTMLButtonElement>(
      ".nui-accordion__header"
    );

    // 1. Open sec-3 while sec-1 stays open
    headers[2].click();
    flushSync();

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith({
      id: "sec-3",
      isOpen: true,
      openIds: ["sec-1", "sec-3"],
      previousId: undefined,
    });

    expect(headers[0].getAttribute("aria-expanded")).toBe("true");
    expect(headers[2].getAttribute("aria-expanded")).toBe("true");

    // 2. Close sec-1; sec-3 stays open
    headers[0].click();
    flushSync();

    expect(onToggle).toHaveBeenCalledTimes(2);
    expect(onToggle).toHaveBeenLastCalledWith({
      id: "sec-1",
      isOpen: false,
      openIds: ["sec-3"],
      previousId: undefined,
    });

    expect(headers[0].getAttribute("aria-expanded")).toBe("false");
    expect(headers[2].getAttribute("aria-expanded")).toBe("true");
  });

  it("does not toggle disabled items when clicked", () => {
    const onToggle = vi.fn();
    const { accordion } = mountAccordion({
      items: sampleItems,
      defaultOpenIds: ["sec-1"],
      onToggle,
    });

    const headers = accordion.querySelectorAll<HTMLButtonElement>(
      ".nui-accordion__header"
    );

    // sec-2 is disabled
    expect(headers[1].disabled).toBe(true);
    headers[1].click();
    flushSync();

    expect(onToggle).not.toHaveBeenCalled();
    expect(headers[1].getAttribute("aria-expanded")).toBe("false");
  });

  it.each([
    { startIdx: 0, key: "ArrowDown", expectedIdx: 2, desc: "skips disabled sec-2 to sec-3" },
    { startIdx: 2, key: "ArrowDown", expectedIdx: 3, desc: "moves from sec-3 to sec-4" },
    { startIdx: 3, key: "ArrowDown", expectedIdx: 0, desc: "wraps around from last sec-4 to first sec-1" },
    { startIdx: 0, key: "ArrowUp", expectedIdx: 3, desc: "wraps around backwards from first sec-1 to last sec-4" },
    { startIdx: 2, key: "ArrowUp", expectedIdx: 0, desc: "skips disabled sec-2 back to sec-1" },
    { startIdx: 0, key: "End", expectedIdx: 3, desc: "moves to last enabled header sec-4" },
    { startIdx: 3, key: "Home", expectedIdx: 0, desc: "moves to first enabled header sec-1" },
  ])("keyboard navigation: $desc ($key from header $startIdx -> header $expectedIdx)", ({ startIdx, key, expectedIdx }) => {
    const { accordion } = mountAccordion({ items: sampleItems });
    const headers = accordion.querySelectorAll<HTMLButtonElement>(".nui-accordion__header");

    headers[startIdx].focus();
    headers[startIdx].dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
    );
    flushSync();

    expect(document.activeElement).toBe(headers[expectedIdx]);
  });

  it("skips disabled boundary headers when pressing Home or End", () => {
    const edgeItems: AccordionItem[] = [
      { id: "sec-1", title: "First Disabled", content: "...", disabled: true },
      { id: "sec-2", title: "Second Enabled", content: "..." },
      { id: "sec-3", title: "Third Enabled", content: "..." },
      { id: "sec-4", title: "Last Disabled", content: "...", disabled: true },
    ];
    const { accordion } = mountAccordion({ items: edgeItems });
    const headers = accordion.querySelectorAll<HTMLButtonElement>(".nui-accordion__header");

    headers[1].focus(); // focused on sec-2 (first enabled)

    // End key moves to sec-3 (last ENABLED), skipping disabled sec-4
    headers[1].dispatchEvent(
      new KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true })
    );
    flushSync();
    expect(document.activeElement).toBe(headers[2]);

    // Home key moves to sec-2 (first ENABLED), skipping disabled sec-1
    headers[2].dispatchEvent(
      new KeyboardEvent("keydown", { key: "Home", bubbles: true, cancelable: true })
    );
    flushSync();
    expect(document.activeElement).toBe(headers[1]);
  });

  it("activates accordion headers with Enter and Space keys", () => {
    const onToggle = vi.fn();
    const { accordion } = mountAccordion({
      items: sampleItems,
      onToggle,
    });

    const headers = accordion.querySelectorAll<HTMLButtonElement>(
      ".nui-accordion__header"
    );

    // 1. Enter key on header 0 opens sec-1
    headers[0].dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })
    );
    flushSync();

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(headers[0].getAttribute("aria-expanded")).toBe("true");

    // 2. Space key on header 0 closes sec-1
    headers[0].dispatchEvent(
      new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true })
    );
    flushSync();

    expect(onToggle).toHaveBeenCalledTimes(2);
    expect(headers[0].getAttribute("aria-expanded")).toBe("false");
  });

  it("supports custom panel snippet and provides item-specific context to each open panel", () => {
    const customPanel = createRawSnippet((item: () => AccordionItem) => ({
      render: () =>
        `<div class="custom-panel-item" data-id="${item().id}">Custom: ${item().title} - ${item().content}</div>`,
    }));

    const { accordion } = mountAccordion({
      items: sampleItems,
      defaultOpenIds: ["sec-1", "sec-3"],
      multiple: true,
      panel: customPanel,
    });

    const panelItems = accordion.querySelectorAll(".custom-panel-item");
    expect(panelItems).toHaveLength(4); // 4 items in DOM with hidden panels

    expect(panelItems[0].getAttribute("data-id")).toBe("sec-1");
    expect(panelItems[0].textContent).toBe("Custom: General Settings - General options");

    expect(panelItems[2].getAttribute("data-id")).toBe("sec-3");
    expect(panelItems[2].textContent).toBe("Custom: Keybinds - Keybinds options");
  });

  it("supports controlled and two-way bound openIds state", () => {
    const openIdsState = bindState<string[]>(["sec-1"]);

    const { accordion } = mountAccordion({
      items: sampleItems,
      multiple: true,
      get openIds() {
        return openIdsState.current;
      },
      set openIds(v) {
        openIdsState.current = v;
      },
    });

    const headers = accordion.querySelectorAll<HTMLButtonElement>(
      ".nui-accordion__header"
    );

    expect(headers[0].getAttribute("aria-expanded")).toBe("true");
    expect(headers[2].getAttribute("aria-expanded")).toBe("false");

    // 1. Internal toggle updates two-way bound state
    headers[2].click();
    flushSync();

    expect(openIdsState.current).toEqual(["sec-1", "sec-3"]);
    expect(headers[2].getAttribute("aria-expanded")).toBe("true");

    // 2. External mutation updates accordion UI
    openIdsState.current = ["sec-4"];
    flushSync();

    expect(headers[0].getAttribute("aria-expanded")).toBe("false");
    expect(headers[2].getAttribute("aria-expanded")).toBe("false");
    expect(headers[3].getAttribute("aria-expanded")).toBe("true");
  });

  it("trims multiple IDs in single mode and synchronizes parent state back", () => {
    const openIdsState = bindState<string[]>(["sec-1", "sec-3"]);

    const { accordion } = mountAccordion({
      items: sampleItems,
      multiple: false,
      get openIds() {
        return openIdsState.current;
      },
      set openIds(v) {
        openIdsState.current = v;
      },
    });

    // Parent state is trimmed to first item, preventing state desynchronization
    expect(openIdsState.current).toEqual(["sec-1"]);

    const headers = accordion.querySelectorAll<HTMLButtonElement>(
      ".nui-accordion__header"
    );
    expect(headers[0].getAttribute("aria-expanded")).toBe("true");
    expect(headers[2].getAttribute("aria-expanded")).toBe("false");
  });

  it("handles items appearing asynchronously after mount and initializes defaults once available", () => {
    const itemsState = bindState<AccordionItem[]>([]);

    const { accordion } = mountAccordion({
      get items() {
        return itemsState.current;
      },
      defaultOpenIds: ["sec-3"],
    });

    expect(accordion.children.length).toBe(0);

    // Items load asynchronously
    itemsState.current = sampleItems;
    flushSync();

    const headers = accordion.querySelectorAll<HTMLButtonElement>(
      ".nui-accordion__header"
    );
    expect(headers).toHaveLength(4);
    expect(headers[2].getAttribute("aria-expanded")).toBe("true");
  });

  it("reactively cleans up openIds and updates bound prop when items are removed", () => {
    const itemsState = bindState(sampleItems);
    const openIdsState = bindState<string[]>(["sec-3"]);

    const { accordion } = mountAccordion({
      get items() {
        return itemsState.current;
      },
      get openIds() {
        return openIdsState.current;
      },
      set openIds(v) {
        openIdsState.current = v;
      },
    });

    const headers = accordion.querySelectorAll<HTMLButtonElement>(
      ".nui-accordion__header"
    );
    expect(headers[2].getAttribute("aria-expanded")).toBe("true");

    // Remove sec-3 from items list
    itemsState.current = sampleItems.filter((i) => i.id !== "sec-3");
    flushSync();

    // sec-3 removed from items, openIdsState trimmed
    expect(openIdsState.current).toEqual([]);
    const updatedHeaders = accordion.querySelectorAll<HTMLButtonElement>(
      ".nui-accordion__header"
    );
    expect(updatedHeaders).toHaveLength(3);
    updatedHeaders.forEach((h) => {
      expect(h.getAttribute("aria-expanded")).toBe("false");
    });
  });

  it("opens all sections initially when defaultOpenAll is true in multiple mode", () => {
    const { accordion } = mountAccordion({
      items: sampleItems,
      multiple: true,
      defaultOpenAll: true,
    });

    const headers = accordion.querySelectorAll<HTMLButtonElement>(
      ".nui-accordion__header"
    );
    headers.forEach((h) => {
      expect(h.getAttribute("aria-expanded")).toBe("true");
    });
  });

  it("ignores defaultOpenAll when multiple is false", () => {
    const { accordion } = mountAccordion({
      items: sampleItems,
      multiple: false,
      defaultOpenAll: true,
    });

    const headers = accordion.querySelectorAll<HTMLButtonElement>(
      ".nui-accordion__header"
    );
    headers.forEach((h) => {
      expect(h.getAttribute("aria-expanded")).toBe("false");
    });
  });

  it("renders item.content containing HTML as plain text without parsing DOM nodes", () => {
    const htmlItems: AccordionItem[] = [
      { id: "sec-html", title: "HTML Test", content: "<b>Raw bold text</b>" },
    ];
    const { accordion } = mountAccordion({
      items: htmlItems,
      defaultOpenIds: ["sec-html"],
    });

    const content = accordion.querySelector(".nui-accordion__content")!;
    expect(content.querySelector("b")).toBeNull();
    expect(content.textContent).toBe("<b>Raw bold text</b>");
  });

  it("sends NUI events via client.send and handles synchronous exceptions and rejected promises", async () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // 1. Success path
    const mockSend = vi.fn().mockReturnValue(Promise.resolve());
    const mockClient = { send: mockSend } as unknown as SvelteNuiClient;

    const { accordion } = mountAccordion({
      items: sampleItems,
      client: mockClient,
      eventName: "accordion_change",
    });

    const headers = accordion.querySelectorAll<HTMLButtonElement>(
      ".nui-accordion__header"
    );

    headers[0].click();
    flushSync();

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith("accordion_change", {
      id: "sec-1",
      isOpen: true,
      openIds: ["sec-1"],
      previousId: undefined,
      count: 1,
    });
    expect(consoleWarnSpy).not.toHaveBeenCalled();

    // 2. Synchronous exception path
    mockSend.mockImplementation(() => {
      throw new Error("Sync transport failure");
    });

    headers[0].click();
    flushSync();

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("failed to send event"),
      expect.any(Error)
    );

    // 3. Rejected Promise path
    consoleWarnSpy.mockClear();
    mockSend.mockReturnValue(Promise.reject(new Error("Async network failure")));

    headers[0].click();
    flushSync();
    await new Promise((r) => setTimeout(r, 0));

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("failed to send event"),
      expect.any(Error)
    );
  });
});
