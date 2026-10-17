import { mount, flushSync as svelteFlushSync } from 'svelte';
import NuiFileInput from '../../src/components/forms/NuiFileInput.svelte';
import type { FileInfo } from '../../src/components/forms/NuiFileInput.types';

export function setInputFiles(input: HTMLInputElement, files: File[]): void {
  try {
    const dt = new DataTransfer();
    for (const file of files) {
      dt.items.add(file);
    }
    input.files = dt.files;
  } catch {
    // Array-based fallback with .item() matching FileList interface.
    // We intentionally avoid Object.setPrototypeOf(fileList, FileList.prototype)
    // because real browser FileList getter accessors require internal slots and
    // throw "TypeError: Illegal invocation" when invoked on plain objects.
    const fileList = Object.assign([...files], {
      item: (index: number) => files[index] ?? null
    });
    Object.defineProperty(input, 'files', {
      value: fileList,
      configurable: true,
      writable: true
    });
  }
}

export interface MountFileInputConfig {
  id?: string;
  name?: string;
  label?: string;
  description?: string;
  accept?: string;
  multiple?: boolean | (() => boolean);
  maxSize?: number | (() => number);
  maxFiles?: number | (() => number);
  value?: File | File[] | null;
  files?: FileInfo[];
  disabled?: boolean | (() => boolean);
  placeholder?: string;
  showPreview?: boolean | (() => boolean);
  ariaLabel?: string;
  error?: string;
  eventName?: string;
  onChange?: (files: FileInfo[], rawFiles: File | File[] | null) => void;
  onError?: (errorMessage: string) => void;
  client?: { send: (...args: any[]) => void };
}

export function mountFileInput(
  container: HTMLElement,
  config: MountFileInputConfig = {}
) {
  // Per-instance reactive version counter
  let version = $state(0);
  const bump = () => {
    version++;
    svelteFlushSync();
  };

  let currentVal = config.value !== undefined ? config.value : null;
  let currentFiles: FileInfo[] = config.files !== undefined ? config.files : [];

  const {
    value,
    files,
    multiple,
    showPreview,
    maxFiles,
    disabled,
    maxSize,
    ...rest
  } = config;

  // Note: reading `void version` in getters registers reactive dependencies
  // inside Svelte 5 reactive contexts ($derived, $effect, and template expressions).
  // Non-reactive reads outside of reactive contexts (e.g. one-off let x = props.prop)
  // will not be tracked by design.
  const props: Record<string, unknown> = {
    get value() {
      void version;
      return currentVal;
    },
    set value(v: File | File[] | null) {
      currentVal = v;
    },
    get files() {
      void version;
      return currentFiles;
    },
    set files(f: FileInfo[]) {
      currentFiles = f;
    },
    ...rest
  };

  const dynamicProps: Record<string, unknown> = {
    multiple,
    showPreview,
    maxFiles,
    disabled,
    maxSize
  };

  for (const [k, v] of Object.entries(dynamicProps)) {
    if (v === undefined) continue;
    Object.defineProperty(
      props,
      k,
      typeof v === 'function'
        ? {
            get: () => {
              void version;
              return (v as () => unknown)();
            },
            enumerable: true,
            configurable: true
          }
        : { value: v, enumerable: true, configurable: true, writable: true }
    );
  }

  const instance = mount(NuiFileInput, {
    target: container,
    props
  });
  svelteFlushSync();

  return {
    instance,
    update: bump,
    getValue: () => currentVal,
    setValue: (v: File | File[] | null) => {
      currentVal = v;
      bump();
    },
    getFiles: () => currentFiles,
    setFiles: (f: FileInfo[]) => {
      currentFiles = f;
      bump();
    },
    getInput: () => container.querySelector<HTMLInputElement>('input[type="file"]')!,
    selectFiles: (files: File[]) => {
      const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
      setInputFiles(input, files);
      input.dispatchEvent(new Event('change', { bubbles: true }));
      bump();
    }
  };
}
