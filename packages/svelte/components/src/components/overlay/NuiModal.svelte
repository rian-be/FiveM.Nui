<script module lang="ts">
  export interface ModalAction {
    /**
     * Unique action identifier within the modal.
     * Used as a keyed `#each` identifier and for `initialFocus` targeting.
     */
    id?: string;
    label: string;
    variant?: "primary" | "secondary" | "danger";
    disabled?: boolean;
    /** Automatically closes the modal after `onclick` succeeds (does not throw or return `false`). */
    closeOnClick?: boolean;
    /** Action callback. Returning `false` or throwing an error prevents `closeOnClick` from closing. */
    onclick?: (event: MouseEvent) => unknown | Promise<unknown>;
  }

  export interface ModalLabels {
    dialog?: string;
    close?: string;
  }

  interface ModalStackEntry {
    token: symbol;
    getBackdrop: () => HTMLElement | null;
    getDialog: () => HTMLElement | null;
    previousFocus: HTMLElement | null;
  }

  interface UnregisterResult {
    wasTop: boolean;
    topDialog: HTMLElement | null;
    candidateFocus: HTMLElement | null;
    fallbackFocus: HTMLElement | null;
  }

  const SCROLL_LOCK_CLASS = "nui-scroll-locked";
  const modalStack: ModalStackEntry[] = [];
  const inertedElements = new Map<HTMLElement, { ariaHidden: string | null }>();
  let originalFocus: HTMLElement | null = null;

  /**
   * Portal action: moves the backdrop directly into `document.body` so that
   * sibling isolation (`inert`) works reliably even when the app mounts inside `<div id="app">`.
   */
  function portal(node: HTMLElement, target: HTMLElement = document.body) {
    target.appendChild(node);
    return {
      destroy() {
        node.remove();
      },
    };
  }

  /**
   * Walks up from `activeBackdrop` to `document.body` and marks all sibling branches
   * at every ancestor level as `inert` and `aria-hidden="true"`.
   * Also isolates lower modals in the stack.
   */
  function syncModalIsolation() {
    if (typeof document === "undefined") return;

    const topEntry = modalStack.at(-1);

    if (!topEntry) {
      for (const [el, prev] of inertedElements.entries()) {
        el.inert = false;
        if (prev.ariaHidden === null) {
          el.removeAttribute("aria-hidden");
        } else {
          el.setAttribute("aria-hidden", prev.ariaHidden);
        }
      }
      inertedElements.clear();
      return;
    }

    const activeBackdrop = topEntry.getBackdrop();
    if (!activeBackdrop || !activeBackdrop.isConnected) return;

    const shouldBeInert = new Set<HTMLElement>();

    let current: HTMLElement | null = activeBackdrop;
    while (current && current !== document.body && current.parentElement) {
      const parentEl: HTMLElement = current.parentElement;
      for (const sibling of Array.from(parentEl.children)) {
        if (
          sibling instanceof HTMLElement &&
          sibling !== current &&
          sibling.tagName !== "SCRIPT" &&
          sibling.tagName !== "STYLE"
        ) {
          shouldBeInert.add(sibling);
        }
      }
      current = parentEl;
    }

    // Isolate direct children of document.body except the branch containing activeBackdrop
    for (const child of Array.from(document.body.children)) {
      if (
        child instanceof HTMLElement &&
        child !== current &&
        child.tagName !== "SCRIPT" &&
        child.tagName !== "STYLE"
      ) {
        shouldBeInert.add(child);
      }
    }

    // Explicitly ensure lower modals in the stack are inert and top modal is active
    for (const entry of modalStack) {
      const backdrop = entry.getBackdrop();
      if (!backdrop) continue;
      if (entry.token === topEntry.token) {
        shouldBeInert.delete(backdrop);
      } else {
        shouldBeInert.add(backdrop);
      }
    }

    // Un-inert elements that no longer need isolation
    for (const [el, prev] of inertedElements.entries()) {
      if (!shouldBeInert.has(el)) {
        el.inert = false;
        if (prev.ariaHidden === null) {
          el.removeAttribute("aria-hidden");
        } else {
          el.setAttribute("aria-hidden", prev.ariaHidden);
        }
        inertedElements.delete(el);
      }
    }

    // Apply inert to newly isolated elements (preserving pre-existing inert elements)
    for (const el of shouldBeInert) {
      if (!inertedElements.has(el)) {
        if (el.inert) continue; // Already inerted by consumer code
        inertedElements.set(el, { ariaHidden: el.getAttribute("aria-hidden") });
        el.inert = true;
        el.setAttribute("aria-hidden", "true");
      }
    }
  }

  function registerModal(entry: ModalStackEntry) {
    if (modalStack.length === 0) {
      originalFocus =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      document.body.classList.add(SCROLL_LOCK_CLASS);
    }

    // Prevent duplicate registration of the same token
    const existingIdx = modalStack.findIndex((e) => e.token === entry.token);
    if (existingIdx !== -1) {
      modalStack[existingIdx] = entry;
    } else {
      modalStack.push(entry);
    }

    syncModalIsolation();
  }

  function unregisterModal(
    token: symbol,
    closingDialogEl: HTMLElement | null,
  ): UnregisterResult {
    const index = modalStack.findIndex((entry) => entry.token === token);
    const wasTop = index !== -1 && index === modalStack.length - 1;
    const removedEntry = index !== -1 ? modalStack[index] : undefined;

    if (index !== -1) modalStack.splice(index, 1);

    if (closingDialogEl) {
      if (originalFocus && closingDialogEl.contains(originalFocus)) {
        originalFocus = removedEntry?.previousFocus ?? null;
      }
      for (const entry of modalStack) {
        if (
          entry.previousFocus &&
          closingDialogEl.contains(entry.previousFocus)
        ) {
          entry.previousFocus = removedEntry?.previousFocus ?? null;
        }
      }
    }

    syncModalIsolation();

    if (modalStack.length === 0) {
      document.body.classList.remove(SCROLL_LOCK_CLASS);
      const fallbackFocus = originalFocus;
      originalFocus = null;

      return {
        wasTop,
        topDialog: null,
        candidateFocus: removedEntry?.previousFocus ?? null,
        fallbackFocus,
      };
    }

    return {
      wasTop,
      topDialog: modalStack.at(-1)?.getDialog() ?? null,
      candidateFocus: removedEntry?.previousFocus ?? null,
      fallbackFocus: null,
    };
  }

  function isTopModal(token: symbol) {
    return modalStack.at(-1)?.token === token;
  }
</script>

<script lang="ts">
  import { tick } from "svelte";
  import { fade, scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { DEV } from "esm-env";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  const FOCUSABLE_SELECTOR =
    'a[href], area[href], button, input:not([type="hidden"]), select, textarea, iframe, [tabindex], [contenteditable="true"]';

  /**
   * Note on transitions: animations are tied to the internal `{#if open}` block.
   * Control visibility via the `open` prop rather than wrapping `<NuiModal>` in an
   * external `{#if show}` block so that exit transitions and focus cleanup run properly.
   */
  interface Props
    extends Omit<
      HTMLAttributes<HTMLDivElement>,
      "children" | "title" | "role" | "tabindex"
    > {
    /** Controls whether the modal is open. */
    open?: boolean;
    /** Modal header title. */
    title?: string;
    /** Optional description text rendered inside the body and linked via `aria-describedby`. */
    description?: string;
    /** Modal body content. */
    children?: Snippet;
    /**
     * Custom header snippet. Receives `titleId` so you can bind `id={titleId}`
     * to your custom heading element for `aria-labelledby`.
     */
    header?: Snippet<[titleId: string]>;
    /** Custom footer snippet (replaces the default `actions` bar). */
    footer?: Snippet;
    /** Footer action buttons. Each `action.id` must be unique if provided. */
    actions?: ModalAction[];
    /** Master switch for user dismissal. Individual flags (`closeOnEscape`, `closeOnBackdrop`, `showClose`) override this when defined. */
    closable?: boolean;
    /** Allow dismissing via the Escape key (defaults to `closable`). */
    closeOnEscape?: boolean;
    /** Allow dismissing by clicking the backdrop (defaults to `closable`). */
    closeOnBackdrop?: boolean;
    /** Render the header close ("X") button (defaults to `closable`). */
    showClose?: boolean;
    /** Modal width preset. */
    size?: "sm" | "md" | "lg" | "xl" | "full";
    /** Enable entry and exit transitions (respects `prefers-reduced-motion`). */
    animated?: boolean;
    /** Semantic ARIA role. */
    role?: "dialog" | "alertdialog";
    /** Action `id` or valid CSS selector to focus when the modal opens. */
    initialFocus?: string;
    /** Accessible labels for the dialog and close button. */
    labels?: ModalLabels;
    /**
     * Called when the user dismisses the modal (via Escape, backdrop, close button, or an action with `closeOnClick`).
     * Not called when `open` is set to `false` programmatically by the parent.
     */
    onClose?: () => void;
    /** Called when an action callback throws or rejects. */
    onActionError?: (error: unknown, action: ModalAction) => void;
  }

  const uid = $props.id();
  const titleId = `nui-modal-${uid}-title`;
  const descId = `nui-modal-${uid}-desc`;
  const token = Symbol("nui-modal");

  let {
    open = $bindable(false),
    title = "",
    description = "",
    children,
    header,
    footer,
    actions = [],
    closable = true,
    closeOnEscape,
    closeOnBackdrop,
    showClose,
    size = "md",
    animated = false,
    role = "dialog",
    initialFocus,
    labels = {},
    onClose,
    onActionError,
    class: className = "",
    "aria-label": userAriaLabel,
    "aria-labelledby": userAriaLabelledby,
    "aria-describedby": userAriaDescribedby,
    ...rest
  }: Props = $props();

  const canCloseOnEscape = $derived(closeOnEscape ?? closable);
  const canCloseOnBackdrop = $derived(closeOnBackdrop ?? closable);
  const shouldShowClose = $derived(showClose ?? closable);

  const dialogLabel = $derived(labels.dialog ?? "Dialog");
  const closeButtonLabel = $derived(labels.close ?? "Close");

  const resolvedAriaLabelledby = $derived(
    userAriaLabelledby ?? (title ? titleId : undefined),
  );
  const resolvedAriaLabel = $derived(
    resolvedAriaLabelledby ? undefined : (userAriaLabel ?? dialogLabel),
  );
  const resolvedAriaDescribedby = $derived(
    userAriaDescribedby ?? (description ? descId : undefined),
  );

  let modalEl: HTMLElement | null = $state(null);
  let backdropEl: HTMLElement | null = $state(null);
  let pendingActionKey: string | null = $state(null);
  let prefersReducedMotion = $state(false);
  let isRegistered = false;
  let lastKnownModalEl: HTMLElement | null = null;

  $effect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    prefersReducedMotion = mediaQuery.matches;

    const listener = (e: MediaQueryListEvent) => {
      prefersReducedMotion = e.matches;
    };

    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  });

  const transitionDuration = $derived(
    animated && !prefersReducedMotion ? 150 : 0,
  );

  /**
   * Checks whether an element and its ancestor chain are visible, not inert/hidden,
   * and capable of receiving focus across both modern Chromium and older CEF builds.
   */
  function isElementVisibleAndInteractive(
    el: HTMLElement,
    boundary?: HTMLElement | null,
  ): boolean {
    if (!el.isConnected) return false;
    if (el.matches(":disabled")) return false;
    if (el.getClientRects().length === 0) return false;
    if (el.closest('[inert], [aria-hidden="true"]')) return false;

    if (typeof el.checkVisibility === "function") {
      return el.checkVisibility({
        visibilityProperty: true,
        contentVisibilityAuto: true,
        checkOpacity: false,
      });
    }

    let current: HTMLElement | null = el;
    while (current) {
      if (current.inert || current.getAttribute("aria-hidden") === "true") {
        return false;
      }
      const style = window.getComputedStyle(current);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.visibility === "collapse" ||
        style.contentVisibility === "hidden"
      ) {
        return false;
      }
      if (current === boundary) break;
      current = current.parentElement;
    }

    return true;
  }

  function isFocusableCandidate(
    el: HTMLElement | null | undefined,
    root?: HTMLElement | null,
  ): el is HTMLElement {
    if (!el || el.tabIndex < 0) return false;
    return isElementVisibleAndInteractive(el, root);
  }

  function getFocusables(root: HTMLElement | null): HTMLElement[] {
    if (!root) return [];
    return [...root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
      (el) => isFocusableCandidate(el, root),
    );
  }

  function resolveInitialFocusTarget(
    root: HTMLElement,
    specifier: string | undefined,
  ): HTMLElement | undefined {
    if (!specifier) return undefined;

    const byActionId = [
      ...root.querySelectorAll<HTMLElement>("[data-action]"),
    ].find((el) => el.dataset.action === specifier);

    if (isFocusableCandidate(byActionId, root)) {
      return byActionId;
    }

    try {
      const bySelector = root.querySelector<HTMLElement>(specifier);
      if (isFocusableCandidate(bySelector, root)) {
        return bySelector;
      }
    } catch {
      // Ignore invalid CSS selector syntax
    }

    return undefined;
  }

  function releaseModalFromStack() {
    if (!isRegistered) return;
    isRegistered = false;

    const closingEl = modalEl ?? lastKnownModalEl;
    lastKnownModalEl = null;

    const result = unregisterModal(token, closingEl);
    if (!result.wasTop) return;

    if (result.topDialog && result.topDialog.isConnected) {
      if (
        result.candidateFocus &&
        result.topDialog.contains(result.candidateFocus) &&
        isFocusableCandidate(result.candidateFocus, result.topDialog)
      ) {
        result.candidateFocus.focus();
        return;
      }
      (getFocusables(result.topDialog)[0] ?? result.topDialog).focus();
      return;
    }

    if (
      result.candidateFocus &&
      !closingEl?.contains(result.candidateFocus) &&
      isElementVisibleAndInteractive(result.candidateFocus)
    ) {
      result.candidateFocus.focus();
      return;
    }

    if (
      result.fallbackFocus &&
      !closingEl?.contains(result.fallbackFocus) &&
      isElementVisibleAndInteractive(result.fallbackFocus)
    ) {
      result.fallbackFocus.focus();
    }
  }

  function requestClose(allowed: boolean) {
    if (!allowed || !open || pendingActionKey !== null) return;
    open = false;
    onClose?.();
  }

  async function handleActionClick(
    action: ModalAction,
    actionKey: string,
    event: MouseEvent,
  ) {
    if (action.disabled || pendingActionKey !== null) return;

    pendingActionKey = actionKey;
    try {
      const result = await action.onclick?.(event);
      if (action.closeOnClick && result !== false && open) {
        open = false;
        onClose?.();
      }
    } catch (error) {
      if (onActionError) {
        onActionError(error, action);
      } else {
        console.error("[NuiModal] Action handler failed:", error);
      }
    } finally {
      pendingActionKey = null;
    }
  }

  // Dev-mode warning for duplicate action IDs
  $effect(() => {
    if (!DEV) return;
    const seen = new Set<string>();
    for (const action of actions) {
      if (!action.id) continue;
      if (seen.has(action.id)) {
        console.warn(
          `[NuiModal] Duplicate action.id="${action.id}" detected. Action IDs must be unique.`,
        );
      }
      seen.add(action.id);
    }
  });

  // Open lifecycle: register immediately, defer stack release until exit transition completes
  $effect(() => {
    if (!open) {
      if (transitionDuration === 0 && isRegistered) {
        releaseModalFromStack();
      }
      return;
    }

    const currentActive =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    let cancelled = false;
    isRegistered = true;

    registerModal({
      token,
      getBackdrop: () => backdropEl,
      getDialog: () => modalEl,
      previousFocus: currentActive,
    });

    tick().then(() => {
      if (cancelled || !open || !isTopModal(token)) return;

      lastKnownModalEl = modalEl;
      syncModalIsolation();

      const root = modalEl;
      if (!root) return;

      const requested = resolveInitialFocusTarget(root, initialFocus);

      const primary = root.querySelector<HTMLElement>(
        '.nui-modal__button--primary:not([aria-disabled="true"]):not(:disabled)',
      );
      const validPrimary = isFocusableCandidate(primary, root)
        ? primary
        : undefined;

      const focusables = getFocusables(root);
      const firstNonClose = focusables.find(
        (el) => !el.classList.contains("nui-modal__close"),
      );

      const target =
        requested ?? validPrimary ?? firstNonClose ?? focusables[0] ?? root;

      target.focus();
    });

    return () => {
      cancelled = true;
    };
  });

  // Safety cleanup if the entire component is unmounted while open or mid-transition
  $effect(() => {
    return () => {
      if (isRegistered) {
        releaseModalFromStack();
      }
    };
  });

  function onWindowKeydown(event: KeyboardEvent) {
    // Keep focus trapped even during the 150ms outro transition, but ignore Escape once closing
    if (!isRegistered || !isTopModal(token)) return;

    if (event.key === "Escape") {
      if (open && canCloseOnEscape) {
        event.preventDefault();
        event.stopPropagation();
        requestClose(canCloseOnEscape);
      }
      return;
    }

    if (event.key !== "Tab") return;

    const root = modalEl;
    if (!root) return;

    const active = document.activeElement;

    // Fast path for CEF performance: if focus is already inside the modal, check raw candidates
    // first so we only compute full visibility when wrapping around the first/last boundaries.
    if (
      active instanceof HTMLElement &&
      root.contains(active) &&
      active !== root
    ) {
      const rawCandidates =
        root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (rawCandidates.length > 2) {
        const firstRaw = rawCandidates[0];
        const lastRaw = rawCandidates[rawCandidates.length - 1];
        if (
          active !== firstRaw &&
          active !== lastRaw &&
          isFocusableCandidate(firstRaw, root) &&
          isFocusableCandidate(lastRaw, root)
        ) {
          return; // Let the browser handle native internal Tab navigation
        }
      }
    }

    const focusables = getFocusables(root);

    if (focusables.length === 0) {
      event.preventDefault();
      root.focus();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (event.shiftKey && (active === first || active === root)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    } else if (!root.contains(active)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  }

  function onWindowFocusIn(event: FocusEvent) {
    if (!isRegistered || !isTopModal(token)) return;

    const root = modalEl;
    const target = event.target;

    if (!root || !(target instanceof Node) || root.contains(target)) return;

    (getFocusables(root)[0] ?? root).focus();
  }

  let pointerDownOnBackdrop = false;

  function onBackdropPointerDown(event: PointerEvent) {
    pointerDownOnBackdrop = event.target === event.currentTarget;
  }

  function onBackdropClick(event: MouseEvent) {
    const shouldClose =
      pointerDownOnBackdrop &&
      event.target === event.currentTarget &&
      canCloseOnBackdrop;

    pointerDownOnBackdrop = false;

    if (shouldClose) requestClose(canCloseOnBackdrop);
  }
</script>

<svelte:window onkeydown={onWindowKeydown} onfocusin={onWindowFocusIn} />

{#if open}
  <!--
    svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions:
    The backdrop is a purely visual scrim (`role="presentation"`). Keyboard dismissal is handled
    via the Escape key on `<svelte:window>` and the explicit close button inside the dialog.
  -->
  <div
    use:portal
    bind:this={backdropEl}
    class={["nui-modal-backdrop", !open && "nui-modal-backdrop--closing"]}
    role="presentation"
    transition:fade={{ duration: transitionDuration }}
    onoutroend={releaseModalFromStack}
    onpointerdown={onBackdropPointerDown}
    onclick={onBackdropClick}
  >
    <!--
      svelte-ignore a11y_no_noninteractive_tabindex:
      The dialog container is focusable via script (tabindex="-1") for programmatic focus management.
    -->
    <div
      {...rest}
      bind:this={modalEl}
      class={["nui-modal", `nui-modal--${size}`, className]}
      {role}
      aria-modal="true"
      aria-labelledby={resolvedAriaLabelledby}
      aria-label={resolvedAriaLabel}
      aria-describedby={resolvedAriaDescribedby}
      tabindex="-1"
      transition:scale={{
        duration: transitionDuration,
        start: transitionDuration > 0 ? 0.96 : 1,
        easing: cubicOut,
      }}
    >
      {#if header}
        <header class="nui-modal__header">
          {#if title && !userAriaLabelledby}
            <span id={titleId} class="nui-modal__sr-only">{title}</span>
          {/if}
          {@render header(titleId)}
        </header>
      {:else if title || shouldShowClose}
        <header class="nui-modal__header">
          {#if title}
            <h2 id={titleId} class="nui-modal__title">{title}</h2>
          {/if}

          {#if shouldShowClose}
            <button
              type="button"
              class="nui-modal__close"
              aria-label={closeButtonLabel}
              onclick={() => requestClose(shouldShowClose)}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          {/if}
        </header>
      {/if}

      {#if description || children}
        <div class="nui-modal__body">
          {#if description}
            <p id={descId} class="nui-modal__description">{description}</p>
          {/if}
          {@render children?.()}
        </div>
      {/if}

      {#if footer}
        <footer class="nui-modal__footer">
          {@render footer()}
        </footer>
      {:else if actions.length > 0}
        <footer class="nui-modal__footer">
          {#each actions as action, index (action.id ?? index)}
            {@const actionKey = action.id ?? String(index)}
            {@const isPending = pendingActionKey !== null}
            <button
              type="button"
              data-action={action.id}
              class="nui-modal__button nui-modal__button--{action.variant ??
                'secondary'}"
              disabled={action.disabled}
              aria-disabled={action.disabled || isPending ? "true" : undefined}
              aria-busy={pendingActionKey === actionKey ? "true" : undefined}
              onclick={(e) => handleActionClick(action, actionKey, e)}
            >
              {action.label}
            </button>
          {/each}
        </footer>
      {/if}
    </div>
  </div>
{/if}

<style>
  :global(body.nui-scroll-locked) {
    overflow: hidden !important;
  }

  .nui-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--nui-z-modal, 1000);
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    padding: 1rem;
    background: var(--nui-scrim, rgb(0 0 0 / 0.65));
  }

  .nui-modal-backdrop--closing {
    pointer-events: none;
  }

  .nui-modal {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    max-width: calc(100vw - 2rem);
    max-height: calc(100vh - 2rem);
    overflow: hidden;
    background: var(--nui-surface, #18181b);
    color: var(--nui-fg, #fafafa);
    border: 1px solid var(--nui-border, #27272a);
    border-radius: var(--nui-radius, 0.5rem);
    box-shadow: 0 25px 60px rgb(0 0 0 / 0.45);
    font-family: inherit;
  }

  .nui-modal:focus-visible {
    outline: 2px solid var(--nui-primary, #3b82f6);
    outline-offset: -3px;
  }

  .nui-modal--sm {
    width: 20rem;
  }
  .nui-modal--md {
    width: 30rem;
  }
  .nui-modal--lg {
    width: 45rem;
  }
  .nui-modal--xl {
    width: 60rem;
  }
  .nui-modal--full {
    width: calc(100vw - 2rem);
    height: calc(100vh - 2rem);
  }

  .nui-modal__sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .nui-modal__header {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.875rem 1.25rem;
    border-bottom: 1px solid var(--nui-border, #27272a);
  }

  .nui-modal__title {
    margin: 0;
    font: inherit;
    font-size: 1.125rem;
    font-weight: 600;
    line-height: 1.35;
  }

  .nui-modal__close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: auto;
    border: 0;
    border-radius: var(--nui-radius-sm, 0.25rem);
    background: transparent;
    color: inherit;
    cursor: pointer;
    opacity: 0.65;
    padding: 0.25rem;
    transition:
      opacity 0.15s ease,
      background-color 0.15s ease;
  }

  .nui-modal__close:hover {
    opacity: 1;
    background: var(--nui-hover, rgb(255 255 255 / 0.06));
  }

  .nui-modal__close:focus-visible {
    opacity: 1;
    outline: 2px solid var(--nui-primary, #3b82f6);
    outline-offset: 2px;
  }

  .nui-modal__body {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1.25rem;
    flex: 1 1 auto;
    overflow-y: auto;
    min-height: 0;
  }

  .nui-modal__description {
    margin: 0;
    opacity: 0.85;
    line-height: 1.5;
  }

  .nui-modal__footer {
    display: flex;
    flex: none;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0.875rem 1.25rem;
    border-top: 1px solid var(--nui-border, #27272a);
    justify-content: flex-end;
    background: var(--nui-surface-alt, #101012);
  }

  .nui-modal__button {
    padding: 0.5rem 1rem;
    border: 1px solid transparent;
    border-radius: var(--nui-radius, 0.375rem);
    font: inherit;
    font-weight: 500;
    cursor: pointer;
    transition:
      opacity 0.15s ease,
      background-color 0.15s ease;
  }

  .nui-modal__button:hover:not(:disabled):not([aria-disabled="true"]) {
    opacity: 0.85;
  }

  .nui-modal__button:focus-visible {
    outline: 2px solid var(--nui-primary, #3b82f6);
    outline-offset: 2px;
  }

  .nui-modal__button:disabled,
  .nui-modal__button[aria-disabled="true"] {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .nui-modal__button--primary {
    background: var(--nui-primary, #3b82f6);
    color: var(--nui-primary-fg, #fff);
  }

  .nui-modal__button--secondary {
    background: transparent;
    border-color: var(--nui-border, #3f3f46);
    color: var(--nui-fg, #fafafa);
  }

  .nui-modal__button--danger {
    background: var(--nui-danger, #ef4444);
    color: var(--nui-danger-fg, #fff);
  }

  @media (prefers-reduced-motion: reduce) {
    .nui-modal__close,
    .nui-modal__button {
      transition: none;
    }
  }
</style>
