import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, unmount, createRawSnippet } from "svelte";
import { bindState, flushSync } from "../helpers/testHelper.svelte";
import NuiTabs, { type Tab } from "../../src/components/navigation/NuiTabs.svelte";

describe("NuiTabs - Accessibility and Keyboard Interaction", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  const sampleTabs: Tab[] = [
    { id: "account", label: "Account" },
    { id: "security", label: "Security", disabled: true },
    { id: "billing", label: "Billing" },
    { id: "notifications", label: "Notifications" },
  ];

  it("renders tablist with default label and correct ARIA attributes", () => {
    const inst = mount(NuiTabs, {
      target: container,
      props: {
        tabs: sampleTabs,
      },
    });

    const tablist = container.querySelector('[role="tablist"]');
    expect(tablist).not.toBeNull();
    expect(tablist?.getAttribute("aria-label")).toBe("Tabs");

    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs).toHaveLength(4);

    // First enabled tab should be active by default
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    expect(tabs[0].getAttribute("tabindex")).toBe("0");

    // Disabled tab
    expect(tabs[1].getAttribute("disabled")).toBe("");
    expect(tabs[1].getAttribute("aria-selected")).toBe("false");
    expect(tabs[1].getAttribute("tabindex")).toBe("-1");

    unmount(inst);
  });

  it("supports custom tablist label", () => {
    const inst = mount(NuiTabs, {
      target: container,
      props: {
        tabs: sampleTabs,
        label: "Settings Sections",
      },
    });

    const tablist = container.querySelector('[role="tablist"]');
    expect(tablist?.getAttribute("aria-label")).toBe("Settings Sections");

    unmount(inst);
  });

  it("handles keyboard navigation (ArrowRight / ArrowLeft / Home / End) and skips disabled tabs", () => {
    const onTabChange = vi.fn();
    const currentTab = bindState("account");

    const inst = mount(NuiTabs, {
      target: container,
      props: {
        tabs: sampleTabs,
        get activeTab() {
          return currentTab.current;
        },
        set activeTab(v) {
          currentTab.current = v;
        },
        onTabChange,
      },
    });

    const tablist = container.querySelector<HTMLElement>('[role="tablist"]')!;

    // Navigate right: skips "security" (disabled) -> moves to "billing"
    tablist.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    flushSync();

    expect(currentTab.current).toBe("billing");
    expect(onTabChange).toHaveBeenCalledWith("billing");

    // Navigate End -> moves to "notifications"
    tablist.dispatchEvent(
      new KeyboardEvent("keydown", { key: "End", bubbles: true }),
    );
    flushSync();

    expect(currentTab.current).toBe("notifications");

    // Navigate Home -> moves back to "account"
    tablist.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Home", bubbles: true }),
    );
    flushSync();

    expect(currentTab.current).toBe("account");

    unmount(inst);
  });

  it("renders tabpanel associated with the active tab", () => {
    const panelSnippet = createRawSnippet((id: () => string) => ({
      render: () => `<div>Panel for ${id()}</div>`,
    }));

    const inst = mount(NuiTabs, {
      target: container,
      props: {
        tabs: sampleTabs,
        activeTab: "billing",
        children: panelSnippet,
      },
    });

    const panel = container.querySelector('[role="tabpanel"]');
    expect(panel).not.toBeNull();
    expect(panel?.getAttribute("tabindex")).toBe("0");

    const billingTab = container.querySelectorAll('[role="tab"]')[2];
    expect(billingTab.id).toBeTruthy();
    expect(panel?.getAttribute("aria-labelledby")).toBe(billingTab.id);
    expect(panel?.textContent).toContain("Panel for billing");

    unmount(inst);
  });

  it("does not call onTabChange when fallback selects tab automatically upon tab list changes", () => {
    const onTabChange = vi.fn();
    const tabs = bindState([
      { id: "tab-1", label: "Tab 1" },
      { id: "tab-2", label: "Tab 2" },
    ]);
    const activeTab = bindState("tab-2");

    const inst = mount(NuiTabs, {
      target: container,
      props: {
        get tabs() {
          return tabs.current;
        },
        get activeTab() {
          return activeTab.current;
        },
        set activeTab(v) {
          activeTab.current = v;
        },
        onTabChange,
      },
    });

    expect(activeTab.current).toBe("tab-2");

    // Remove tab-2 from tabs array
    tabs.current = [{ id: "tab-1", label: "Tab 1" }];
    flushSync();

    // Fallback automatically sets activeTab to "tab-1"
    expect(activeTab.current).toBe("tab-1");
    // But onTabChange is NOT invoked because user did not interact
    expect(onTabChange).not.toHaveBeenCalled();

    unmount(inst);
  });

  it("safely handles rejected promises from client.send()", async () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mockClient = {
      send: vi.fn().mockRejectedValue(new Error("Network disconnect")),
    } as any;

    const inst = mount(NuiTabs, {
      target: container,
      props: {
        tabs: sampleTabs,
        client: mockClient,
        eventName: "onTabSwitch",
      },
    });

    const billingTab = container.querySelectorAll<HTMLButtonElement>('[role="tab"]')[2];
    billingTab.click();
    flushSync();

    expect(mockClient.send).toHaveBeenCalledWith("onTabSwitch", {
      from: "account",
      to: "billing",
    });

    // Wait for microtask to verify catch
    await Promise.resolve();

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[fivem-nui-components] NuiTabs: failed to send event",
      expect.any(Error),
    );

    unmount(inst);
  });
});
