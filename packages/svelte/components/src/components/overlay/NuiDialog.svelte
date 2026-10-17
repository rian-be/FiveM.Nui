<script module lang="ts">
  export interface NuiDialogAction {
    id: string;
    label: string;
    variant?: "primary" | "secondary" | "danger";
    disabled?: boolean;
  }
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { nui } from "@fivem-nui/svelte";
  import type { SvelteNuiClient } from "@fivem-nui/svelte";
  import NuiModal from "./NuiModal.svelte";
  import type { ModalAction } from "./NuiModal.svelte";

  interface Props
    extends Omit<
      HTMLAttributes<HTMLDivElement>,
      "children" | "title" | "role"
    > {
    open?: boolean;
    title?: string;
    message?: string;
    actions?: NuiDialogAction[];
    client?: SvelteNuiClient;
    /** Event sent to the game when an action is chosen. */
    eventName?: string;
    /** Event sent when dismissed through Escape or the backdrop. */
    cancelEvent?: string;
    /** Receives the selected action id, or null when cancelled. */
    onAction?: (actionId: string | null) => void;
    /** Allow dismissal through Escape and the backdrop. */
    dismissible?: boolean;
    /** Explicit semantic role; danger styling does not imply alertdialog. */
    role?: "dialog" | "alertdialog";
    /** Action id to focus first; defaults to primary, then first focusable. */
    initialFocus?: string;
    /** Accessible name used when no title is provided. */
    label?: string;
    children?: Snippet;
  }

  let {
    open = $bindable(false),
    title = "",
    message = "",
    actions = [{ id: "ok", label: "OK", variant: "primary" }],
    client = nui,
    eventName = "",
    cancelEvent = "",
    onAction,
    dismissible = true,
    role = "dialog",
    initialFocus,
    label = "Dialog",
    children,
    ...rest
  }: Props = $props();

  function send(name: string, payload: Record<string, unknown>) {
    try {
      void Promise.resolve(client.send(name, payload)).catch(
        (error: unknown) => {
          console.warn(
            "[fivem-nui-components] NuiDialog: failed to send event",
            error,
          );
        },
      );
    } catch (error) {
      console.warn(
        "[fivem-nui-components] NuiDialog: failed to send event",
        error,
      );
    }
  }

  function finishWithAction(actionId: string | null) {
    open = false;
    try {
      onAction?.(actionId);
    } finally {
      if (actionId === null) {
        if (cancelEvent) send(cancelEvent, { cancelled: true });
      } else if (eventName) {
        send(eventName, { action: actionId });
      }
    }
  }

  const mappedActions: ModalAction[] = $derived(
    actions.map((action) => ({
      id: action.id,
      label: action.label,
      variant: action.variant,
      disabled: action.disabled,
      onclick: () => finishWithAction(action.id),
    })),
  );
</script>

<NuiModal
  {...rest}
  bind:open
  {title}
  description={message}
  actions={mappedActions}
  closable={dismissible}
  showClose={false}
  size="sm"
  {role}
  {initialFocus}
  labels={{ dialog: label }}
  onClose={() => finishWithAction(null)}
  {children}
/>
