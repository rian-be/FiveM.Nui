import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  NuiErrorHandler,
  NuiErrorCategory,
  installGlobalErrorHandlers,
  captureRenderError,
  defaultIsRenderError,
  formatStackTrace,
  parseStackTrace
} from '../src';

describe('Global Error Listeners & StackTrace', () => {
  let originalWindow: any;
  let listeners: Record<string, Function[]> = {};

  beforeEach(() => {
    listeners = {};
    originalWindow = globalThis.window;

    // Mock minimal DOM window for testing
    (globalThis as any).window = {
      addEventListener: vi.fn((event: string, callback: Function) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(callback);
      }),
      removeEventListener: vi.fn((event: string, callback: Function) => {
        if (!listeners[event]) return;
        listeners[event] = listeners[event].filter(cb => cb !== callback);
      })
    };
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
    vi.restoreAllMocks();
  });

  it('should parse and format V8 / CEF stack traces cleanly', () => {
    const rawStack = `Error: Something crashed
    at renderComponent (http://nui-comps-demo/dist/comps-demo.js:142:15)
    at mount (http://nui-comps-demo/dist/comps-demo.js:10:5)`;

    const frames = parseStackTrace(rawStack);
    expect(frames.length).toBe(2);
    expect(frames[0].method).toBe('renderComponent');
    expect(frames[0].file).toBe('http://nui-comps-demo/dist/comps-demo.js');
    expect(frames[0].line).toBe(142);
    expect(frames[0].column).toBe(15);

    const formatted = formatStackTrace(new Error('test'));
    expect(formatted).toContain('Error: test');
  });

  it('should install error and unhandledrejection listeners and capture script error', async () => {
    const handler = new NuiErrorHandler();
    const captured: any[] = [];

    const uninstall = installGlobalErrorHandlers({
      handler,
      onCaptured: (info) => captured.push(info)
    });

    expect(window.addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
    expect(window.addEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));

    // Simulate regular logic script error
    const errorEvent = {
      message: 'Uncaught TypeError: Cannot read properties of undefined',
      filename: 'http://nui-comps-demo/dist/comps-demo.js',
      lineno: 42,
      colno: 10,
      error: new TypeError('Cannot read properties of undefined'),
      preventDefault: vi.fn()
    };

    listeners['error'][0](errorEvent);

    await new Promise((res) => setTimeout(res, 50));

    expect(captured.length).toBe(1);
    expect(captured[0].category).toBe(NuiErrorCategory.SCRIPT);
    expect(captured[0].source).toBe('http://nui-comps-demo/dist/comps-demo.js');
    expect(captured[0].lineno).toBe(42);
    expect(captured[0].colno).toBe(10);
    expect(captured[0].stack).toBeTruthy();

    uninstall();
    expect(window.removeEventListener).toHaveBeenCalledWith('error', expect.any(Function));
    expect(window.removeEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
  });

  it('should categorize UI rendering errors via DOM/lifecycle heuristics', async () => {
    const handler = new NuiErrorHandler();
    const captured: any[] = [];

    installGlobalErrorHandlers({
      handler,
      onCaptured: (info) => captured.push(info)
    });

    const renderEvent = {
      message: 'Uncaught Error: component mount failed during hydration',
      filename: 'http://nui-comps-demo/dist/comps-demo.js',
      lineno: 100,
      colno: 5,
      error: new Error('hydration mismatch at root vnode'),
      preventDefault: vi.fn()
    };

    listeners['error'][0](renderEvent);
    await new Promise((res) => setTimeout(res, 50));

    expect(captured.length).toBe(1);
    expect(captured[0].category).toBe(NuiErrorCategory.RENDER);
  });

  it('should allow custom isRenderError predicate function in options', async () => {
    const handler = new NuiErrorHandler();
    const captured: any[] = [];

    installGlobalErrorHandlers({
      handler,
      isRenderError: (error) => error instanceof Error && error.message.includes('CustomUIPanic'),
      onCaptured: (info) => captured.push(info)
    });

    const customEvent = {
      message: 'CustomUIPanic occurred',
      filename: 'http://nui/app.js',
      lineno: 1,
      colno: 1,
      error: new Error('CustomUIPanic in widget'),
      preventDefault: vi.fn()
    };

    listeners['error'][0](customEvent);
    await new Promise((res) => setTimeout(res, 50));

    expect(captured.length).toBe(1);
    expect(captured[0].category).toBe(NuiErrorCategory.RENDER);
  });

  it('should capture unhandled promise rejections', async () => {
    const handler = new NuiErrorHandler();
    const captured: any[] = [];

    installGlobalErrorHandlers({
      handler,
      onCaptured: (info) => captured.push(info)
    });

    const rejectionEvent = {
      reason: new Error('Failed to fetch from FiveM callback bridge'),
      preventDefault: vi.fn()
    };

    listeners['unhandledrejection'][0](rejectionEvent);
    await new Promise((res) => setTimeout(res, 50));

    expect(captured.length).toBe(1);
    expect(captured[0].category).toBe(NuiErrorCategory.UNHANDLED_REJECTION);
    expect(captured[0].error.message).toContain('Failed to fetch');
  });

  it('should support captureRenderError for component boundaries', async () => {
    const handler = new NuiErrorHandler();
    const errorInfo = await captureRenderError(
      new Error('Failed to render catalog item'),
      'CatalogGrid',
      { itemId: 'ammo-9mm' },
      handler
    );

    expect(errorInfo).not.toBeNull();
    expect(errorInfo?.category).toBe(NuiErrorCategory.RENDER);
    expect(errorInfo?.operation).toBe('<CatalogGrid /> render');
    expect(errorInfo?.context?.itemId).toBe('ammo-9mm');
  });
});