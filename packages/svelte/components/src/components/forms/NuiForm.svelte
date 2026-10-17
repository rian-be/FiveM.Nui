<!--
  @component NuiForm
  Accessible form container for FiveM NUI applications with client-side validation rules,
  asynchronous submission locking, CEF-safe confirmation dialog support, resilient error
  handling, and dual event synchronization.
-->
<script lang="ts">
  import { onDestroy } from "svelte";
  import { nui, isBrowser } from "@fivem-nui/svelte";
  import type { SvelteNuiClient } from "@fivem-nui/svelte";
  // Universal form validation engine
  import { validateForm } from "../../composables/useFormValidation";
  import type { ValidationRules } from "../../composables/useFormValidation";

  interface Props {
    /** Main event sent on submit with {@link payload} (or {@link values}). */
    eventName?: string;
    /** Secondary or pre-submit event sent just before {@link eventName} with {@link onSubmitPayload} (or {@link values}). */
    onSubmit?: string;
    /** Event sent when form submission succeeds. */
    onSubmitSuccess?: string;
    /** Event sent when form submission fails. */
    onSubmitError?: string;
    /** Specific payload sent with {@link onSubmit} instead of values. Defaults to {@link values}. */
    onSubmitPayload?: unknown;
    /** Specific payload sent with {@link eventName} instead of values. Defaults to {@link values}. */
    payload?: unknown;
    /** SvelteNuiClient instance for event transport. */
    client?: SvelteNuiClient;
    /**
     * Whether network transport is currently in progress. Supports two-way binding.
     *
     * The component manages this flag only during its own transport phase.
     * It will not reset `loading` to `false` unless it was the one that set it to `true`.
     * If a parent binds `loading` for independent operations, those will not be clobbered.
     */
    loading?: boolean;
    /** Whether the form is disabled. Supports two-way binding. */
    disabled?: boolean;
    /**
     * Whether to automatically reset validation error display status on success.
     * Note: This only resets the submission visibility flag (`submitted`),
     * it does not reset field `values` or native input DOM values.
     * Defaults to false.
     */
    autoReset?: boolean;
    /** Whether confirmation is required before submitting. Defaults to false. */
    confirm?: boolean;
    /** Confirmation message prompt text. Defaults to 'Are you sure you want to submit?'. */
    confirmMessage?: string;
    /** Optional async confirmation handler (e.g. opens custom NuiDialog) safe for FiveM CEF. */
    confirmCallback?: (message: string) => boolean | Promise<boolean>;
    /** Field values validated against rules before the submission event is sent. */
    values?: Record<string, unknown>;
    /** Validation rules mapped by field name. */
    rules?: Record<string, ValidationRules>;
    /**
     * Called locally after a successful submit.
     * Receives the primary event payload (`payload ?? values ?? {}`).
     */
    onSubmitted?: (payload: unknown) => void | Promise<void>;
    /**
     * Called locally when submission is rejected due to validation failure,
     * validation rule exception, CEF confirmation unavailability,
     * confirmation callback exception, or backend transport error.
     * Supports synchronous or asynchronous handlers.
     */
    onRejected?: (error: unknown) => void | Promise<void>;
    children?: import("svelte").Snippet;
  }

  let {
    eventName = "",
    onSubmit = "",
    onSubmitSuccess = "",
    onSubmitError = "",
    onSubmitPayload = undefined,
    payload = undefined,
    client = nui,
    loading = $bindable(false),
    disabled = $bindable(false),
    autoReset = false,
    confirm = false,
    confirmMessage = "Are you sure you want to submit?",
    confirmCallback,
    values = {},
    rules = {},
    onSubmitted,
    onRejected,
    children,
  }: Props = $props();

  let submitted = $state(false);
  let isSubmitting = false;
  let isDestroyed = false;

  onDestroy(() => {
    isDestroyed = true;
  });

  /**
   * Tracks whether the component itself activated `loading`.
   * Prevents `finally` from clobbering a parent-controlled `loading` binding.
   */
  let ownLoading = false;

  // Real-time validation errors derived from current values and rules
  const errors = $derived(
    Object.keys(rules).length
      ? validateForm(values, rules)
      : ({} as Record<string, string>),
  );
  const isValid = $derived(Object.keys(errors).length === 0);

  // Live active errors displayed to the user once submission has been attempted
  const activeErrors = $derived(
    submitted ? errors : ({} as Record<string, string>),
  );
  const hasErrors = $derived(submitted && Object.keys(errors).length > 0);

  /**
   * Resilient event dispatcher that safely captures synchronous exceptions
   * and unhandled Promise rejections from custom or asynchronous NUI clients.
   */
  function safeSend(event: string, data: unknown) {
    if (!event) return;
    try {
      const res = client.send(event, data) as unknown;
      if (res && typeof (res as Promise<unknown>).catch === "function") {
        (res as Promise<unknown>).catch((err: unknown) => {
          console.error(
            `[fivem-nui-components] Async error sending form event '${event}':`,
            err,
          );
        });
      }
    } catch (err) {
      console.error(
        `[fivem-nui-components] Failed to send form event '${event}':`,
        err,
      );
    }
  }

  /**
   * Safely invokes the onRejected callback, protecting against unhandled rejections
   * or exceptions thrown by consumer application code.
   */
  function safeReject(reason: unknown) {
    try {
      const res = onRejected?.(reason);
      if (res && typeof (res as Promise<void>).catch === "function") {
        (res as Promise<void>).catch((err: unknown) => {
          console.error(
            "[fivem-nui-components] NuiForm: Unhandled rejection in onRejected callback:",
            err,
          );
        });
      }
    } catch (err) {
      console.error(
        "[fivem-nui-components] NuiForm: Exception in onRejected callback:",
        err,
      );
    }
  }

  /**
   * Safely invokes the onSubmitted callback, ensuring consumer application errors
   * are isolated and never misclassified as transport failures.
   */
  function safeSubmitted(body: unknown) {
    try {
      const res = onSubmitted?.(body);
      if (res && typeof (res as Promise<void>).catch === "function") {
        (res as Promise<void>).catch((err: unknown) => {
          console.error(
            "[fivem-nui-components] NuiForm: Unhandled rejection in onSubmitted callback:",
            err,
          );
        });
      }
    } catch (callbackError) {
      console.error(
        "[fivem-nui-components] NuiForm: Exception in onSubmitted callback:",
        callbackError,
      );
    }
  }

  /**
   * Resets the submission and error display state of the form (`submitted = false`).
   * Does not mutate or clear field `values`.
   */
  export function reset() {
    submitted = false;
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    // 1. Immediate lock against concurrent / double submissions
    if (disabled || loading || isSubmitting) return;

    submitted = true;

    // 2. Validate fields — wrapped as an error boundary so a broken custom
    //    rule cannot crash handleSubmit with an unhandled exception.
    let validationFailed = false;
    try {
      validationFailed = !isValid;
    } catch (validationError) {
      console.error(
        "[fivem-nui-components] NuiForm: Exception during validation:",
        validationError,
      );
      safeReject(validationError);
      return;
    }

    if (validationFailed) {
      safeReject(errors);
      return;
    }

    // Lock submission lifecycle immediately
    isSubmitting = true;

    try {
      // 3. CEF-safe confirmation handling
      if (confirm) {
        let confirmed = false;
        try {
          if (typeof confirmCallback === "function") {
            confirmed = await confirmCallback(confirmMessage);
          } else if (
            isBrowser() &&
            typeof window !== "undefined" &&
            typeof window.confirm === "function"
          ) {
            confirmed = window.confirm(confirmMessage);
          } else {
            const cefError = new Error(
              "window.confirm() is unavailable in FiveM CEF and confirmCallback was not provided.",
            );
            console.warn(
              "[fivem-nui-components] NuiForm:",
              cefError.message,
              "Aborting submission.",
            );
            confirmed = false;
            safeReject(cefError);
            return;
          }
        } catch (confirmError) {
          console.error(
            "[fivem-nui-components] NuiForm: Exception in confirmCallback:",
            confirmError,
          );
          confirmed = false;
          safeReject(confirmError);
          return;
        }

        // Re-check state after async confirmation:
        // - component unmounted while dialog was open
        // - user cancelled
        // - parent set disabled = true while dialog was open
        // - parent set loading = true for an independent operation
        if (isDestroyed || !confirmed || disabled || loading) {
          return;
        }
      }

      // 4. Mark loading as true only during actual backend transport.
      //    Track ownership so finally does not clobber a parent-controlled binding.
      loading = true;
      ownLoading = true;

      // Decouple onSubmitPayload vs payload, falling back to values.
      const submitBody = onSubmitPayload ?? values ?? {};
      const eventBody = payload ?? values ?? {};

      // 5. Isolated backend transport execution.
      //    Events are sent sequentially, NOT atomically — if onSubmit succeeds
      //    but eventName fails, the first operation's side effects persist.
      //    For atomic semantics, handle both steps in a single C# callback.
      try {
        if (onSubmit) await client.sendAndWait(onSubmit, submitBody);
        if (isDestroyed) return;
        if (eventName) await client.sendAndWait(eventName, eventBody);
        if (isDestroyed) return;
      } catch (transportError) {
        if (isDestroyed) return;
        const message =
          transportError instanceof Error
            ? transportError.message
            : String(transportError);
        if (onSubmitError) safeSend(onSubmitError, { error: message });
        safeReject(transportError);
        return;
      }

      // 6. Transport succeeded: emit success event safely if still mounted
      if (!isDestroyed && onSubmitSuccess) safeSend(onSubmitSuccess, { success: true });

      if (!isDestroyed && autoReset) {
        submitted = false;
      }

      // 7. Invoke local onSubmitted callback with eventBody (main event payload)
      if (!isDestroyed) safeSubmitted(eventBody);
    } finally {
      if (!isDestroyed) {
        if (ownLoading) {
          loading = false;
          ownLoading = false;
        }
        isSubmitting = false;
      }
    }
  }
</script>

<form
  class="nui-form"
  class:is-invalid={hasErrors}
  class:is-disabled={disabled}
  class:is-loading={loading}
  onsubmit={handleSubmit}
>
  <div class="nui-form-content">
    {@render children?.()}
  </div>

  {#if hasErrors}
    <ul class="nui-form-errors" role="alert" aria-live="polite">
      {#each Object.entries(activeErrors) as [field, message] (field)}
        <li class="nui-form-error-item" data-field={field}>
          <span class="nui-form-error-field">{field}:</span>
          {message}
        </li>
      {/each}
    </ul>
  {/if}
</form>

<style>
  .nui-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
    font-family: inherit;
    box-sizing: border-box;
  }

  .nui-form-content {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .nui-form.is-disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  .nui-form.is-loading {
    cursor: wait;
  }

  .nui-form-errors {
    margin: 0;
    padding-left: 1.25rem;
    color: var(--nui-danger, #ef4444);
    font-size: 0.8125rem;
    line-height: 1.4;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .nui-form-error-item {
    word-break: break-word;
  }

  .nui-form-error-field {
    font-weight: 600;
    text-transform: capitalize;
  }
</style>
