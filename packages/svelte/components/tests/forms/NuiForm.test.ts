import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, unmount, type ComponentProps } from 'svelte';
import type { SvelteNuiClient } from '@fivem-nui/svelte';
import { bindState, flushSync } from '../helpers/testHelper.svelte';
import NuiForm from '../../src/components/forms/NuiForm.svelte';

type MountedComponent = ReturnType<typeof mount>;

describe('NuiForm - concurrency locking, confirmation, error isolation, and live validation', () => {
  let container: HTMLElement;
  let mountedApps: MountedComponent[] = [];
  let originalConfirm: typeof window.confirm;

  const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

  /**
   * Creates a mock NuiClient for tests. Casts as `typeof client & SvelteNuiClient`
   * to satisfy component prop types without requiring verbose `as any` in individual tests.
   */
  function createMockClient(
    overrides: Partial<{
      send: ReturnType<typeof vi.fn>;
      sendAndWait: ReturnType<typeof vi.fn>;
    }> = {}
  ) {
    const client = {
      send: vi.fn(),
      sendAndWait: vi.fn().mockResolvedValue({ success: true }),
      ...overrides
    };
    return client as typeof client & SvelteNuiClient;
  }

  function mountForm(props: ComponentProps<typeof NuiForm>): HTMLFormElement {
    const target = document.createElement('div');
    container.appendChild(target);
    const inst = mount(NuiForm, {
      target,
      props
    });
    mountedApps.push(inst);
    flushSync();
    const form = target.querySelector<HTMLFormElement>('form')!;
    (form as unknown as { __instance: MountedComponent }).__instance = inst;
    return form;
  }

  function unmountForm(formOrInst: HTMLFormElement | MountedComponent) {
    const inst = (formOrInst as unknown as { __instance?: MountedComponent }).__instance ?? (formOrInst as MountedComponent);
    const idx = mountedApps.indexOf(inst);
    if (idx !== -1) {
      mountedApps.splice(idx, 1);
    }
    unmount(inst);
  }

  beforeEach(() => {
    originalConfirm = window.confirm;
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    while (mountedApps.length > 0) {
      const app = mountedApps.pop()!;
      unmount(app);
    }
    container.remove();
    document.body.innerHTML = '';
    window.confirm = originalConfirm;
    vi.restoreAllMocks();
  });

  it('calls event.preventDefault() upon form submit to prevent browser navigation', () => {
    const mockClient = createMockClient();
    const form = mountForm({
      eventName: 'nui:testPreventDefault',
      client: mockClient
    });

    const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(submitEvent);

    expect(submitEvent.defaultPrevented).toBe(true);
  });

  it('prevents submission entirely when form is initially disabled', async () => {
    const mockSendAndWait = vi.fn();
    const mockConfirmCallback = vi.fn();
    const mockClient = createMockClient({ sendAndWait: mockSendAndWait });
    const disabledState = bindState(true);

    const form = mountForm({
      eventName: 'nui:disabledSubmit',
      confirm: true,
      confirmCallback: mockConfirmCallback,
      client: mockClient,
      get disabled() {
        return disabledState.current;
      },
      set disabled(v) {
        disabledState.current = v;
      }
    });

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();

    expect(mockConfirmCallback).toHaveBeenCalledTimes(0);
    expect(mockSendAndWait).toHaveBeenCalledTimes(0);
    expect(form.classList.contains('is-disabled')).toBe(true);
  });

  it('prevents multiple concurrent submissions when submit is clicked repeatedly during async wait', async () => {
    let resolveTransport: (val: unknown) => void = () => {};
    const transportPromise = new Promise((res) => {
      resolveTransport = res;
    });

    const mockSendAndWait = vi.fn(() => transportPromise);
    const mockClient = createMockClient({ sendAndWait: mockSendAndWait });
    const currentLoading = bindState(false);

    const form = mountForm({
      eventName: 'nui:submitData',
      client: mockClient,
      get loading() {
        return currentLoading.current;
      },
      set loading(v) {
        currentLoading.current = v;
      }
    });

    // 1st submit attempt
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    flushSync();

    expect(currentLoading.current).toBe(true);
    expect(mockSendAndWait).toHaveBeenCalledTimes(1);

    // 2nd rapid submit attempt while 1st is still resolving
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    flushSync();

    // Must still be 1 (locked against concurrent calls)
    expect(mockSendAndWait).toHaveBeenCalledTimes(1);

    // Resolve the async transport
    resolveTransport({ success: true });
    await vi.waitFor(() => {
      expect(currentLoading.current).toBe(false);
    });
  });

  it('aborts submission when confirmCallback returns false', async () => {
    const mockClient = createMockClient();
    const loadingState = bindState(false);
    const mockOnRejected = vi.fn();

    const form = mountForm({
      eventName: 'nui:deleteItem',
      confirm: true,
      confirmCallback: vi.fn(async () => false),
      client: mockClient,
      onRejected: mockOnRejected,
      get loading() {
        return loadingState.current;
      },
      set loading(v) {
        loadingState.current = v;
      }
    });

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();

    expect(mockClient.sendAndWait).toHaveBeenCalledTimes(0);
    expect(loadingState.current).toBe(false);
    expect(mockOnRejected).toHaveBeenCalledTimes(0);
  });

  it('proceeds with submission when confirmCallback returns true', async () => {
    const mockClient = createMockClient();
    const loadingState = bindState(false);
    const mockOnSubmitted = vi.fn();

    const form = mountForm({
      eventName: 'nui:deleteItem',
      confirm: true,
      confirmCallback: vi.fn(async () => true),
      client: mockClient,
      onSubmitted: mockOnSubmitted,
      get loading() {
        return loadingState.current;
      },
      set loading(v) {
        loadingState.current = v;
      }
    });

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => {
      expect(mockClient.sendAndWait).toHaveBeenCalledTimes(1);
    });

    expect(mockClient.sendAndWait).toHaveBeenCalledWith('nui:deleteItem', {});
    expect(loadingState.current).toBe(false);
    expect(mockOnSubmitted).toHaveBeenCalledWith({});
  });

  it('aborts submission, invokes onRejected, and logs error to console.error when confirmCallback throws an exception', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mockClient = createMockClient();
    const mockOnRejected = vi.fn();
    const loadingState = bindState(false);
    const confirmError = new Error('Dialog confirmation crashed');

    const form = mountForm({
      eventName: 'nui:deleteItemError',
      confirm: true,
      confirmCallback: vi.fn(async () => {
        throw confirmError;
      }),
      client: mockClient,
      onRejected: mockOnRejected,
      get loading() {
        return loadingState.current;
      },
      set loading(v) {
        loadingState.current = v;
      }
    });

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();

    expect(mockClient.sendAndWait).toHaveBeenCalledTimes(0);
    expect(mockOnRejected).toHaveBeenCalledWith(confirmError);
    expect(loadingState.current).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Exception in confirmCallback:'),
      confirmError
    );
  });

  it('aborts submission when confirm is required but window.confirm is unavailable in CEF', async () => {
    const mockClient = createMockClient();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Simulate CEF where window.confirm is undefined
    (window as any).confirm = undefined;

    const form = mountForm({
      eventName: 'nui:dangerousAction',
      confirm: true,
      client: mockClient
    });

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();

    // Must NOT submit without confirmation
    expect(mockClient.sendAndWait).toHaveBeenCalledTimes(0);
    expect(warnSpy).toHaveBeenCalledWith(
      '[fivem-nui-components] NuiForm:',
      expect.stringContaining('window.confirm() is unavailable in FiveM CEF'),
      'Aborting submission.'
    );
  });

  it('isolates transport errors from onSubmitted callback errors', async () => {
    const mockSendAndWait = vi.fn().mockResolvedValue({ ok: true });
    const mockSend = vi.fn();
    const mockClient = createMockClient({ send: mockSend, sendAndWait: mockSendAndWait });

    const mockOnRejected = vi.fn();
    const onSubmittedError = new Error('Local UI routing exception');
    const mockOnSubmitted = vi.fn(() => {
      throw onSubmittedError;
    });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const form = mountForm({
      eventName: 'nui:saveProfile',
      onSubmitSuccess: 'nui:saveSuccess',
      onSubmitError: 'nui:saveError',
      client: mockClient,
      onSubmitted: mockOnSubmitted,
      onRejected: mockOnRejected
    });

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => {
      expect(mockSend).toHaveBeenCalledWith('nui:saveSuccess', { success: true });
    });

    // Backend transport succeeded!
    expect(mockSendAndWait).toHaveBeenCalledTimes(1);

    // onSubmitted was called and its exception logged
    expect(mockOnSubmitted).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Exception in onSubmitted callback:'),
      onSubmittedError
    );

    // Since backend transport succeeded, onSubmitError and onRejected MUST NOT be called!
    expect(mockSend).not.toHaveBeenCalledWith('nui:saveError', expect.anything());
    expect(mockOnRejected).toHaveBeenCalledTimes(0);
  });

  it('safely handles rejected Promises from client.send() without crashing or emitting unhandled rejections', async () => {
    let unhandled = false;
    const rejectionHandler = () => {
      unhandled = true;
    };
    const nodeProcess = (globalThis as any).process;
    nodeProcess?.on?.('unhandledRejection', rejectionHandler);

    try {
      const sendError = new Error('Async NUI bridge offline');
      const mockSend = vi.fn().mockRejectedValue(sendError);
      const mockSendAndWait = vi.fn().mockRejectedValue(new Error('Server error'));
      const mockClient = createMockClient({ send: mockSend, sendAndWait: mockSendAndWait });

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const form = mountForm({
        eventName: 'nui:testCrash',
        onSubmitError: 'nui:testError',
        client: mockClient
      });

      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await vi.waitFor(() => {
        expect(mockSend).toHaveBeenCalledWith('nui:testError', { error: 'Server error' });
      });

      expect(mockSendAndWait).toHaveBeenCalledTimes(1);
      await vi.waitFor(() => {
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining("Async error sending form event 'nui:testError':"),
          sendError
        );
      });

      // Allow microtasks and next event loop tick to settle before checking unhandled flag
      await flushPromises();
      await flushPromises();
      expect(unhandled).toBe(false);
    } finally {
      nodeProcess?.off?.('unhandledRejection', rejectionHandler);
    }
  });

  it('displays errors live only after the first submission attempt', () => {
    const currentValues = bindState({ email: 'invalid-email', username: '' });

    const form = mountForm({
      get values() {
        return currentValues.current;
      },
      rules: {
        email: { required: true, email: true },
        username: { required: true, min: 3 }
      }
    });

    // 1. Before submit: user enters invalid data, but no errors should be shown yet
    expect(form.querySelector('[role="alert"]')).toBeNull();
    currentValues.current = { email: 'still-invalid', username: 'ab' };
    flushSync();
    expect(form.querySelector('[role="alert"]')).toBeNull();

    // 2. Submit with invalid data: errors appear
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    flushSync();

    const alertEl = form.querySelector('[role="alert"]');
    expect(alertEl).not.toBeNull();
    expect(form.querySelector('.nui-form-error-item[data-field="email"]')).not.toBeNull();
    expect(form.querySelector('.nui-form-error-item[data-field="username"]')).not.toBeNull();

    // 3. User fixes the email field in real-time
    currentValues.current = { email: 'john@example.com', username: 'ab' };
    flushSync();

    // Email error disappears live, username error remains!
    expect(form.querySelector('.nui-form-error-item[data-field="email"]')).toBeNull();
    expect(form.querySelector('.nui-form-error-item[data-field="username"]')).not.toBeNull();

    // 4. User fixes username field
    currentValues.current = { email: 'john@example.com', username: 'john_doe' };
    flushSync();

    // All errors cleared live without needing another submit!
    expect(form.querySelector('[role="alert"]')).toBeNull();
    expect(form.classList.contains('is-invalid')).toBe(false);
  });

  it('blocks submission and displays errors without sending backend events when validation fails', async () => {
    const mockClient = createMockClient();
    const mockOnRejected = vi.fn();

    const form = mountForm({
      eventName: 'nui:validationTest',
      client: mockClient,
      onRejected: mockOnRejected,
      values: { email: 'bad-email' },
      rules: {
        email: { required: true, email: true },
        name: { required: true }
      }
    });

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();

    expect(mockClient.sendAndWait).toHaveBeenCalledTimes(0);
    expect(form.querySelector('[role="alert"]')).not.toBeNull();
    expect(form.classList.contains('is-invalid')).toBe(true);
    expect(mockOnRejected).toHaveBeenCalledWith(
      expect.objectContaining({
        email: expect.any(String),
        name: expect.any(String)
      })
    );
  });

  it('delivers independent payloads to onSubmit and eventName without mutual overwrite', async () => {
    const mockClient = createMockClient();
    const mockOnSubmitted = vi.fn();

    const form = mountForm({
      onSubmit: 'nui:preSubmit',
      onSubmitPayload: { step: 'validation_token_123' },
      eventName: 'nui:mainSubmit',
      payload: { user: 'player_1', balance: 500 },
      values: { fallback: true },
      client: mockClient,
      onSubmitted: mockOnSubmitted
    });

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => {
      expect(mockClient.sendAndWait).toHaveBeenCalledWith('nui:mainSubmit', { user: 'player_1', balance: 500 });
    });
    expect(mockClient.sendAndWait).toHaveBeenCalledWith('nui:preSubmit', { step: 'validation_token_123' });
    // Verify fallback values are not forwarded
    expect(mockClient.sendAndWait).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ fallback: true })
    );
    expect(mockOnSubmitted).toHaveBeenCalledWith({ user: 'player_1', balance: 500 });
  });

  it('aborts submission if disabled becomes true while waiting for confirmCallback', async () => {
    let resolveConfirm: (val: boolean) => void = () => {};
    const confirmPromise = new Promise<boolean>((res) => {
      resolveConfirm = res;
    });

    const mockClient = createMockClient();
    const disabledState = bindState(false);
    const loadingState = bindState(false);

    const form = mountForm({
      eventName: 'nui:submitWithConfirmation',
      confirm: true,
      confirmCallback: () => confirmPromise,
      client: mockClient,
      get disabled() {
        return disabledState.current;
      },
      set disabled(v) {
        disabledState.current = v;
      },
      get loading() {
        return loadingState.current;
      },
      set loading(v) {
        loadingState.current = v;
      }
    });

    // 1. Submit initiated
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    flushSync();

    // While waiting for user confirmation, loading should still be false
    expect(loadingState.current).toBe(false);
    expect(mockClient.sendAndWait).toHaveBeenCalledTimes(0);

    // 2. Parent disables form while confirmation modal is still open
    disabledState.current = true;
    flushSync();

    // 3. User confirms the dialog
    resolveConfirm(true);
    await flushPromises();

    // Submission MUST NOT proceed because form was disabled!
    expect(mockClient.sendAndWait).toHaveBeenCalledTimes(0);
    expect(loadingState.current).toBe(false);
  });

  it('reports confirmCallback exceptions to onRejected without emitting onSubmitError', async () => {
    const mockSend = vi.fn();
    const mockClient = createMockClient({ send: mockSend });
    const mockOnRejected = vi.fn();
    const confirmError = new Error('Dialog component crashed');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const form = mountForm({
      eventName: 'nui:confirmCrashTest',
      onSubmitError: 'nui:formError',
      confirm: true,
      confirmCallback: vi.fn().mockRejectedValue(confirmError),
      client: mockClient,
      onRejected: mockOnRejected
    });

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();

    expect(mockClient.sendAndWait).toHaveBeenCalledTimes(0);
    expect(mockSend).not.toHaveBeenCalledWith('nui:formError', expect.anything());
    expect(mockOnRejected).toHaveBeenCalledWith(confirmError);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Exception in confirmCallback:'),
      confirmError
    );
  });

  it('safely handles exceptions or rejections thrown inside onRejected callback and resets loading', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mockClient = createMockClient({
      sendAndWait: vi.fn().mockRejectedValue(new Error('Backend offline'))
    });
    const loadingState = bindState(false);

    const onRejectedError = new Error('Consumer onRejected crash');
    const form = mountForm({
      eventName: 'nui:testRejectCrash',
      client: mockClient,
      get loading() {
        return loadingState.current;
      },
      set loading(v) {
        loadingState.current = v;
      },
      onRejected: vi.fn(() => {
        throw onRejectedError;
      })
    });

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Exception in onRejected callback:'),
      onRejectedError
    );
    // Finally block must have safely cleared loading even when onRejected threw
    expect(loadingState.current).toBe(false);
  });

  it('does not clobber parent-controlled loading after form transport completes', async () => {
    const mockClient = createMockClient({
      sendAndWait: vi.fn().mockResolvedValue({ ok: true })
    });
    const loadingState = bindState(true); // parent set loading = true for its own operation

    const form = mountForm({
      eventName: 'nui:saveData',
      client: mockClient,
      get loading() {
        return loadingState.current;
      },
      set loading(v) {
        loadingState.current = v;
      }
    });

    // Submit is blocked because loading is already true (parent's operation)
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();

    // Form did NOT submit because parent loading blocked it
    expect(mockClient.sendAndWait).toHaveBeenCalledTimes(0);
    // Parent's loading is NOT clobbered
    expect(loadingState.current).toBe(true);

    // Now simulate: parent finishes its operation
    loadingState.current = false;
    flushSync();

    // Submit again — this time it goes through
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => {
      expect(mockClient.sendAndWait).toHaveBeenCalledTimes(1);
      expect(loadingState.current).toBe(false);
    });
  });

  it('aborts submission if loading becomes true during async confirmCallback', async () => {
    let resolveConfirm: (val: boolean) => void = () => {};
    const confirmPromise = new Promise<boolean>((res) => {
      resolveConfirm = res;
    });

    const mockClient = createMockClient();
    const loadingState = bindState(false);

    const form = mountForm({
      eventName: 'nui:loadingRace',
      confirm: true,
      confirmCallback: () => confirmPromise,
      client: mockClient,
      get loading() {
        return loadingState.current;
      },
      set loading(v) {
        loadingState.current = v;
      }
    });

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    flushSync();

    // Parent starts an independent loading operation while confirm is open
    loadingState.current = true;
    flushSync();

    // User confirms
    resolveConfirm(true);
    await flushPromises();

    // Must NOT proceed because parent loading is active
    expect(mockClient.sendAndWait).toHaveBeenCalledTimes(0);
    // Parent's loading must remain true (not clobbered)
    expect(loadingState.current).toBe(true);
  });

  it('invokes onRejected when window.confirm is unavailable in CEF (no confirmCallback)', async () => {
    const mockClient = createMockClient();
    const mockOnRejected = vi.fn();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    (window as any).confirm = undefined;

    const form = mountForm({
      eventName: 'nui:cefRejectTest',
      confirm: true,
      client: mockClient,
      onRejected: mockOnRejected
    });

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();

    expect(mockClient.sendAndWait).toHaveBeenCalledTimes(0);
    expect(warnSpy).toHaveBeenCalledWith(
      '[fivem-nui-components] NuiForm:',
      expect.stringContaining('window.confirm() is unavailable in FiveM CEF'),
      'Aborting submission.'
    );
    expect(mockOnRejected).toHaveBeenCalledTimes(1);
    expect(mockOnRejected.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  it('maps custom, undefined, or null backend responses to standardized { success: true } payload on onSubmitSuccess event', async () => {
    // 1. Backend returns arbitrary object data (e.g. { ok: true, entityId: 1042 })
    const mockSendAndWait = vi.fn().mockResolvedValue({ ok: true, entityId: 1042 });
    const mockSend = vi.fn();
    const mockClient = createMockClient({ send: mockSend, sendAndWait: mockSendAndWait });

    const form = mountForm({
      eventName: 'nui:createEntity',
      onSubmitSuccess: 'nui:entityCreated',
      client: mockClient
    });

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => {
      expect(mockSend).toHaveBeenCalledWith('nui:entityCreated', { success: true });
    });
    expect(mockSendAndWait).toHaveBeenCalledTimes(1);

    // 2. Backend returns null on subsequent submit
    mockSend.mockClear();
    mockSendAndWait.mockResolvedValueOnce(null);
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => {
      expect(mockSend).toHaveBeenCalledWith('nui:entityCreated', { success: true });
    });

    // 3. Backend returns undefined on subsequent submit
    mockSend.mockClear();
    mockSendAndWait.mockResolvedValueOnce(undefined);
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => {
      expect(mockSend).toHaveBeenCalledWith('nui:entityCreated', { success: true });
    });
  });

  it('resets loading to false when backend transport fails or times out', async () => {
    const timeoutError = new Error('Post timeout 10000ms exceeded');
    const mockSendAndWait = vi.fn().mockRejectedValue(timeoutError);
    const mockSend = vi.fn();
    const mockClient = createMockClient({ send: mockSend, sendAndWait: mockSendAndWait });
    const mockOnRejected = vi.fn();
    const loadingState = bindState(false);

    const form = mountForm({
      eventName: 'nui:slowAction',
      onSubmitError: 'nui:slowActionFailed',
      client: mockClient,
      onRejected: mockOnRejected,
      get loading() {
        return loadingState.current;
      },
      set loading(v) {
        loadingState.current = v;
      }
    });

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    flushSync();
    expect(loadingState.current).toBe(true);

    await vi.waitFor(() => {
      expect(mockSend).toHaveBeenCalledWith('nui:slowActionFailed', {
        error: 'Post timeout 10000ms exceeded'
      });
    });

    // Loading MUST return to false after transport error
    expect(loadingState.current).toBe(false);
    expect(mockOnRejected).toHaveBeenCalledWith(timeoutError);
  });

  it('safely handles component unmount while awaiting confirmCallback', async () => {
    let resolveConfirm: (val: boolean) => void = () => {};
    const confirmPromise = new Promise<boolean>((res) => {
      resolveConfirm = res;
    });

    const mockSendAndWait = vi.fn();
    const mockClient = createMockClient({ sendAndWait: mockSendAndWait });
    const mockOnSubmitted = vi.fn();

    const form = mountForm({
      eventName: 'nui:modalUnmount',
      confirm: true,
      confirmCallback: () => confirmPromise,
      client: mockClient,
      onSubmitted: mockOnSubmitted
    });

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    flushSync();

    // Dialog is open and pending. Now unmount the form before user answers
    unmountForm(form);

    // Later, confirm resolves true
    resolveConfirm(true);
    await flushPromises();
    await flushPromises();

    // Since component was unmounted during confirmation, it must not execute further actions
    expect(mockSendAndWait).toHaveBeenCalledTimes(0);
    expect(mockOnSubmitted).toHaveBeenCalledTimes(0);
  });

  it('safely handles component unmount during pending async sendAndWait without executing subsequent callbacks', async () => {
    let resolveTransport: (val: unknown) => void = () => {};
    const transportPromise = new Promise((res) => {
      resolveTransport = res;
    });

    const mockSend = vi.fn();
    const mockSendAndWait = vi.fn(() => transportPromise);
    const mockClient = createMockClient({ send: mockSend, sendAndWait: mockSendAndWait });
    const mockOnSubmitted = vi.fn();
    const loadingState = bindState(false);

    const form = mountForm({
      eventName: 'nui:longTask',
      onSubmitSuccess: 'nui:longTaskSuccess',
      client: mockClient,
      onSubmitted: mockOnSubmitted,
      get loading() {
        return loadingState.current;
      },
      set loading(v) {
        loadingState.current = v;
      }
    });

    // Start submit
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    flushSync();
    expect(loadingState.current).toBe(true);

    // Unmount while transport is still pending
    unmountForm(form);

    // Resolve after unmount
    resolveTransport({ success: true });
    await flushPromises();
    await flushPromises();

    // The unmounted component must not emit success events or invoke user callbacks
    expect(mockSendAndWait).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledTimes(0);
    expect(mockOnSubmitted).toHaveBeenCalledTimes(0);
  });
});
