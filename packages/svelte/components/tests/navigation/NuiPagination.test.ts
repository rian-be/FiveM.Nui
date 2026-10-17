import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, unmount } from "svelte";
import { flushSync, bindState } from "../helpers/testHelper.svelte";
import NuiPagination, {
  getPageItems,
} from "../../src/components/navigation/NuiPagination.svelte";

describe("NuiPagination - getPageItems algorithm", () => {
  describe("slots = 7 (default)", () => {
    it("handles total <= slots without ellipsis", () => {
      expect(getPageItems(5, 1, 7, true)).toEqual([1, 2, 3, 4, 5]);
      expect(getPageItems(7, 3, 7, true)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it("returns exactly 7 items near start", () => {
      // inner = 5 -> pages 1..5, ellipsis-end, 20
      const itemsPage1 = getPageItems(20, 1, 7, true);
      expect(itemsPage1).toHaveLength(7);
      expect(itemsPage1).toEqual([1, 2, 3, 4, 5, "ellipsis-end", 20]);

      const itemsPage4 = getPageItems(20, 4, 7, true);
      expect(itemsPage4).toHaveLength(7);
      expect(itemsPage4).toEqual([1, 2, 3, 4, 5, "ellipsis-end", 20]);
    });

    it("returns exactly 7 items in the middle", () => {
      // current = 10 of 20 -> 1, ellipsis-start, 9, 10, 11, ellipsis-end, 20
      const itemsPage10 = getPageItems(20, 10, 7, true);
      expect(itemsPage10).toHaveLength(7);
      expect(itemsPage10).toEqual([
        1,
        "ellipsis-start",
        9,
        10,
        11,
        "ellipsis-end",
        20,
      ]);
    });

    it("returns exactly 7 items near end", () => {
      // nearEnd: 1, ellipsis-start, 16, 17, 18, 19, 20
      const itemsPage19 = getPageItems(20, 19, 7, true);
      expect(itemsPage19).toHaveLength(7);
      expect(itemsPage19).toEqual([
        1,
        "ellipsis-start",
        16,
        17,
        18,
        19,
        20,
      ]);

      const itemsPage20 = getPageItems(20, 20, 7, true);
      expect(itemsPage20).toHaveLength(7);
      expect(itemsPage20).toEqual([
        1,
        "ellipsis-start",
        16,
        17,
        18,
        19,
        20,
      ]);
    });
  });

  describe("slots = 5 (minimum bound)", () => {
    it("returns exactly 5 items for start, middle, and end", () => {
      const start = getPageItems(15, 2, 5, true);
      expect(start).toHaveLength(5);
      expect(start).toEqual([1, 2, 3, "ellipsis-end", 15]);

      const middle = getPageItems(15, 8, 5, true);
      expect(middle).toHaveLength(5);
      expect(middle).toEqual([1, "ellipsis-start", 8, "ellipsis-end", 15]);

      const end = getPageItems(15, 14, 5, true);
      expect(end).toHaveLength(5);
      expect(end).toEqual([1, "ellipsis-start", 13, 14, 15]);
    });
  });

  describe("slots = 9", () => {
    it("returns exactly 9 items for start, middle, and end", () => {
      const start = getPageItems(30, 3, 9, true);
      expect(start).toHaveLength(9);
      expect(start).toEqual([1, 2, 3, 4, 5, 6, 7, "ellipsis-end", 30]);

      const middle = getPageItems(30, 15, 9, true);
      expect(middle).toHaveLength(9);
      expect(middle).toEqual([
        1,
        "ellipsis-start",
        13,
        14,
        15,
        16,
        17,
        "ellipsis-end",
        30,
      ]);

      const end = getPageItems(30, 29, 9, true);
      expect(end).toHaveLength(9);
      expect(end).toEqual([
        1,
        "ellipsis-start",
        24,
        25,
        26,
        27,
        28,
        29,
        30,
      ]);
    });
  });

  describe("sliding window without ellipsis", () => {
    it("slides a continuous window of `slots` pages", () => {
      const windowItems = getPageItems(20, 10, 7, false);
      expect(windowItems).toHaveLength(7);
      expect(windowItems).toEqual([7, 8, 9, 10, 11, 12, 13]);
    });
  });

  describe("robustness with invalid inputs", () => {
    it("normalizes NaN, Infinity and non-integer maxVisible", () => {
      expect(getPageItems(10, 1, NaN as any, true)).toHaveLength(5);
      expect(getPageItems(10, 1, 4, true)).toHaveLength(5); // minimum is 5
      expect(getPageItems(10, 1, 7.8, true)).toHaveLength(7);
    });
  });
});

describe("NuiPagination - Component interactions & accessibility", () => {
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

  it("renders with semantic landmark and polite live region", () => {
    const inst = mount(NuiPagination, {
      target: container,
      props: {
        totalItems: 100,
        pageSize: 10,
        page: 1,
      },
    });

    const nav = container.querySelector("nav.nui-pagination");
    expect(nav?.getAttribute("aria-label")).toBe("Pagination");

    const info = container.querySelector(".nui-pagination__info");
    expect(info?.getAttribute("aria-live")).toBe("polite");
    expect(info?.textContent?.trim()).toBe("Page 1 of 10");

    unmount(inst);
  });

  it("disables first and previous buttons on page 1", () => {
    const inst = mount(NuiPagination, {
      target: container,
      props: {
        totalItems: 50,
        pageSize: 10,
        page: 1,
      },
    });

    const buttons = container.querySelectorAll<HTMLButtonElement>("button");
    const firstBtn = buttons[0];
    const prevBtn = buttons[1];

    expect(firstBtn.disabled).toBe(true);
    expect(prevBtn.disabled).toBe(true);

    unmount(inst);
  });

  it("fires onChange on user click and updates two-way bind:page", () => {
    const onChange = vi.fn();
    const pageState = bindState(1);

    const inst = mount(NuiPagination, {
      target: container,
      props: {
        totalItems: 50,
        pageSize: 10,
        get page() {
          return pageState.current;
        },
        set page(v) {
          pageState.current = v;
        },
        onChange,
      },
    });

    // Find button for Page 2
    const page2Btn = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((b) => b.textContent?.trim() === "2");

    expect(page2Btn).toBeDefined();
    page2Btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    flushSync();

    expect(pageState.current).toBe(2);
    expect(onChange).toHaveBeenCalledWith(2);

    unmount(inst);
  });

  it("marks active page with aria-current='page'", () => {
    const inst = mount(NuiPagination, {
      target: container,
      props: {
        totalItems: 50,
        pageSize: 10,
        page: 3,
      },
    });

    const activeBtn = container.querySelector(
      "button[aria-current='page']",
    );
    expect(activeBtn).not.toBeNull();
    expect(activeBtn?.textContent?.trim()).toBe("3");

    unmount(inst);
  });

  it("automatically clamps page when totalItems shrinks without invoking onChange", () => {
    const onChange = vi.fn();
    const totalItemsState = bindState(100);
    const pageState = bindState(10);

    const inst = mount(NuiPagination, {
      target: container,
      props: {
        get totalItems() {
          return totalItemsState.current;
        },
        pageSize: 10,
        get page() {
          return pageState.current;
        },
        set page(v) {
          pageState.current = v;
        },
        onChange,
      },
    });

    expect(pageState.current).toBe(10);

    totalItemsState.current = 30;
    flushSync();

    expect(pageState.current).toBe(3);
    expect(onChange).not.toHaveBeenCalled();

    unmount(inst);
  });
});
