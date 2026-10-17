<script lang="ts">
  import { nui } from '@fivem-nui/svelte';
  import type { SvelteNuiClient } from '@fivem-nui/svelte';

  interface Props {
    /** Event name sent to the game when the button is clicked. */
    eventName?: string;
    /** Payload sent along with {@link eventName}. */
    payload?: unknown;
    client?: SvelteNuiClient;
    loading?: boolean;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
    variant?: 'primary' | 'secondary' | 'danger' | 'link';
    size?: 'xs' | 'sm' | 'md' | 'lg';
    /** Event sent right after the main NUI operation succeeds. */
    onSuccess?: string;
    /**
     * Event sent when the local handler or main NUI operation fails.
     * Note: A failure in sending onSuccess will not trigger this.
     */
    onError?: string;
    onSuccessPayload?: unknown;
    onErrorPayload?: unknown;
    /** Local callback invoked when the operation fails. */
    onFailure?: (error: unknown) => void;
    /** Local callback invoked when the operation succeeds. */
    onSuccessCallback?: (result?: unknown) => void;
    /**
     * Predicate deciding whether the button is currently enabled.
     * Function must read reactive Svelte state to update automatically.
     */
    condition?: (() => boolean) | null;
    /**
     * Predicate or boolean that disables the button when true.
     * Function must read reactive Svelte state to update automatically.
     */
    disabledWhen?: (() => boolean) | boolean | null;
    /**
     * When true, keeps loading state true upon successful completion.
     * The parent component is responsible for resetting loading via bind:loading.
     * On error, loading is always reset to false if autoReset is true.
     */
    keepLoadingOnSuccess?: boolean;
    /**
     * @deprecated Use {@link keepLoadingOnSuccess} instead.
     */
    autoUpdateOnSuccess?: boolean;
    /**
     * Reset loading state automatically after click.
     * Set to false if parent exclusively manages loading state via bind:loading.
     */
    autoReset?: boolean;
    /**
     * Local click handler, invoked before the NUI event. Can be async.
     * Return `false` or call `event.preventDefault()` to cancel the subsequent NUI event.
     */
    onclick?: (event: MouseEvent) => boolean | void | Promise<boolean | void>;
    children?: import('svelte').Snippet;
  }

  let {
    eventName = '',
    payload = undefined,
    client = nui,
    loading = $bindable(false),
    disabled = $bindable(false),
    type = 'button',
    variant = 'primary',
    size = 'md',
    onSuccess = '',
    onError = '',
    onSuccessPayload = {},
    onErrorPayload = {},
    onFailure,
    onSuccessCallback,
    condition = null,
    disabledWhen = null,
    keepLoadingOnSuccess = false,
    autoUpdateOnSuccess = false,
    autoReset = true,
    onclick,
    children
  }: Props = $props();

  const shouldKeepLoading = $derived(keepLoadingOnSuccess || autoUpdateOnSuccess);

  const isEnabled = $derived.by(() => {
    if (condition && typeof condition === 'function' && !condition()) return false;
    if (disabledWhen) {
      if (typeof disabledWhen === 'function') {
        if (disabledWhen()) return false;
      } else if (typeof disabledWhen === 'boolean') {
        if (disabledWhen) return false;
      }
    }
    return true;
  });

  async function dispatchClientEvent(name: string, data?: unknown): Promise<unknown> {
    if ('sendAndWait' in client && typeof client.sendAndWait === 'function') {
      return await client.sendAndWait(name, data);
    }
    return client.send(name, data);
  }

  async function handleClick(event: MouseEvent) {
    if (!isEnabled || loading || disabled) return;

    // If there is no NUI event and no custom onclick, let native action proceed
    if (!eventName && !onclick) {
      return;
    }

    loading = true;
    let hasError = false;

    try {
      // 1. Run local onclick hook
      if (onclick) {
        const initialPrevented = event.defaultPrevented;
        const result = await onclick(event);

        // Cancel if onclick returned false or marked event as defaultPrevented
        if (result === false || (!initialPrevented && event.defaultPrevented)) {
          if (autoReset) {
            loading = false;
          }
          return;
        }
      }

      // 2. Prevent native form submission/reset if proceeding with NUI event
      if (eventName && (type === 'submit' || type === 'reset')) {
        event.preventDefault();
      }

      // 3. Send main NUI event
      let operationResult: unknown = undefined;
      if (eventName) {
        operationResult = await dispatchClientEvent(eventName, payload);

        // Handle clients or mocks returning an explicit failure envelope { success: false, error: ... }
        if (
          operationResult &&
          typeof operationResult === 'object' &&
          'success' in operationResult &&
          (operationResult as { success?: boolean }).success === false
        ) {
          const envelope = operationResult as { error?: { message?: string } | string };
          const errMsg =
            typeof envelope.error === 'object' && envelope.error !== null
              ? envelope.error.message || 'NUI operation returned failure'
              : typeof envelope.error === 'string'
                ? envelope.error
                : 'NUI operation returned failure';
          throw new Error(errMsg);
        }
      }

      // 4. Trigger local success callback
      onSuccessCallback?.(operationResult);

      // 5. Send success notification event (isolated so its failure does not trigger onError)
      if (onSuccess) {
        try {
          await dispatchClientEvent(onSuccess, onSuccessPayload);
        } catch (successSendError) {
          console.warn(
            `[NuiButton] Main operation succeeded, but failed to dispatch onSuccess event '${onSuccess}':`,
            successSendError
          );
        }
      }
    } catch (error) {
      hasError = true;
      const message = error instanceof Error ? error.message : String(error);

      // Trigger local failure callback
      onFailure?.(error);

      const basePayload =
        typeof onErrorPayload === 'object' && onErrorPayload !== null && !Array.isArray(onErrorPayload)
          ? onErrorPayload
          : { payload: onErrorPayload };

      if (onError) {
        try {
          await dispatchClientEvent(onError, { ...basePayload, error: message });
        } catch (sendErr) {
          console.error(`[NuiButton] Failed to dispatch onError event '${onError}':`, sendErr);
        }
      }

      console.error(`[NuiButton] Error handling click for event '${eventName || 'local'}':`, error);
    } finally {
      if (autoReset) {
        if (hasError || !shouldKeepLoading) {
          loading = false;
        }
      }
    }
  }
</script>

<button
  {type}
  class="nui-btn nui-btn--{variant} nui-btn--{size}"
  disabled={!isEnabled || disabled || loading}
  aria-busy={loading}
  onclick={handleClick}
>
  {#if loading}
    <span class="nui-btn__spinner" aria-hidden="true"></span>
  {/if}
  {@render children?.()}
</button>

<style>
  .nui-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    border: 1px solid transparent;
    border-radius: var(--nui-radius, 0.375rem);
    font-family: inherit;
    font-weight: 600;
    line-height: 1;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
    box-sizing: border-box;
  }

  .nui-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .nui-btn--xs { padding: 0.2rem 0.5rem;    font-size: 0.75rem; }
  .nui-btn--sm { padding: 0.25rem 0.625rem; font-size: 0.8125rem; }
  .nui-btn--md { padding: 0.5rem 0.875rem;   font-size: 0.9375rem; }
  .nui-btn--lg { padding: 0.75rem 1.25rem;  font-size: 1.0625rem; }

  .nui-btn--primary {
    background: var(--nui-primary, #3b82f6);
    color: #fff;
  }
  .nui-btn--primary:hover:not(:disabled) {
    background: var(--nui-primary-hover, #2563eb);
  }

  .nui-btn--secondary {
    background: transparent;
    border-color: var(--nui-border, #3f3f46);
    color: var(--nui-fg, #fafafa);
  }
  .nui-btn--secondary:hover:not(:disabled) {
    background: var(--nui-hover, rgb(255 255 255 / 0.06));
  }

  .nui-btn--danger {
    background: var(--nui-danger, #ef4444);
    color: #fff;
  }
  .nui-btn--danger:hover:not(:disabled) {
    background: var(--nui-danger-hover, #dc2626);
  }

  .nui-btn--link {
    background: transparent;
    color: var(--nui-primary, #3b82f6);
    padding-left: 0;
    padding-right: 0;
  }
  .nui-btn--link:hover:not(:disabled) {
    text-decoration: underline;
  }

  .nui-btn__spinner {
    width: 0.85em;
    height: 0.85em;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: nui-btn-spin 0.6s linear infinite;
  }

  @keyframes nui-btn-spin {
    to { transform: rotate(360deg); }
  }
</style>
