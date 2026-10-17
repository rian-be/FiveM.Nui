import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, unmount, createRawSnippet } from "svelte";
import { flushSync, bindState } from "../helpers/testHelper.svelte";
import NuiSidebar from "../../src/components/navigation/NuiSidebar.svelte";

describe("NuiSidebar - HTML Attributes, Collapse, and Inert Semantics", () => {
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

  it("applies inert attribute to aside only when closed", () => {
    const sidebarOpen = bindState(true);
    const inst = mount(NuiSidebar, {
      target: container,
      props: {
        get open() {
          return sidebarOpen.current;
        },
        set open(v) {
          sidebarOpen.current = v;
        },
      },
    });

    const aside = container.querySelector("aside.nui-sidebar");
    expect(aside).not.toBeNull();
    expect(aside?.hasAttribute("inert")).toBe(false);

    sidebarOpen.current = false;
    flushSync();

    expect(aside?.hasAttribute("inert")).toBe(true);

    const wrap = container.querySelector(".nui-sidebar-wrap");
    expect(wrap?.classList.contains("nui-sidebar-wrap--collapsed")).toBe(true);

    unmount(inst);
  });

  it("preserves consumer id on aside and links aria-controls from toggle button", () => {
    const inst = mount(NuiSidebar, {
      target: container,
      props: {
        id: "custom-nav-sidebar",
        collapsible: true,
      } as any,
    });

    const aside = container.querySelector("aside.nui-sidebar");
    expect(aside?.id).toBe("custom-nav-sidebar");

    const toggleBtn = container.querySelector<HTMLButtonElement>(
      ".nui-sidebar__toggle",
    );
    expect(toggleBtn?.getAttribute("aria-controls")).toBe("custom-nav-sidebar");
    expect(toggleBtn?.getAttribute("type")).toBe("button");

    unmount(inst);
  });

  it("applies class and style to wrapper and panelClass to inner aside", () => {
    const inst = mount(NuiSidebar, {
      target: container,
      props: {
        class: "my-layout-wrapper",
        panelClass: "my-inner-aside-panel",
        width: 320,
        style: "margin-right: 1rem;",
      } as any,
    });

    const wrap = container.querySelector(".nui-sidebar-wrap");
    expect(wrap?.classList.contains("my-layout-wrapper")).toBe(true);
    expect(wrap?.getAttribute("style")).toMatch(/--nui-sidebar-width:\s*320px/);
    expect(wrap?.getAttribute("style")).toContain("margin-right: 1rem;");

    const aside = container.querySelector("aside.nui-sidebar");
    expect(aside?.classList.contains("my-inner-aside-panel")).toBe(true);

    unmount(inst);
  });

  it("toggles open state and calls onToggle upon clicking toggle button", () => {
    const onToggle = vi.fn();
    const sidebarOpen = bindState(true);

    const inst = mount(NuiSidebar, {
      target: container,
      props: {
        collapsible: true,
        get open() {
          return sidebarOpen.current;
        },
        set open(v) {
          sidebarOpen.current = v;
        },
        onToggle,
      },
    });

    const toggleBtn = container.querySelector<HTMLButtonElement>(
      ".nui-sidebar__toggle",
    )!;

    expect(toggleBtn.getAttribute("aria-expanded")).toBe("true");

    toggleBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    flushSync();

    expect(sidebarOpen.current).toBe(false);
    expect(toggleBtn.getAttribute("aria-expanded")).toBe("false");
    expect(onToggle).toHaveBeenCalledWith(false);

    unmount(inst);
  });

  it("renders brand, children, and footer snippets", () => {
    const brandSnippet = createRawSnippet(() => ({
      render: () => '<span id="brand-slot">Server Logo</span>',
    }));
    const childrenSnippet = createRawSnippet(() => ({
      render: () => '<div id="content-slot">Navigation links</div>',
    }));
    const footerSnippet = createRawSnippet(() => ({
      render: () => '<div id="footer-slot">User profile</div>',
    }));

    const inst = mount(NuiSidebar, {
      target: container,
      props: {
        brand: brandSnippet,
        children: childrenSnippet,
        footer: footerSnippet,
      },
    });

    expect(container.querySelector("#brand-slot")).not.toBeNull();
    expect(container.querySelector("#content-slot")).not.toBeNull();
    expect(container.querySelector("#footer-slot")).not.toBeNull();

    unmount(inst);
  });
});
