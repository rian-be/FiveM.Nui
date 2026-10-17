import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { unmount } from 'svelte';
import type { mount } from 'svelte';
import type { FileInfo, FileMetadata } from '../../src/components/forms/NuiFileInput.types';
import {
  mountFileInput,
  setInputFiles,
  type MountFileInputConfig
} from '../helpers/fileInputHelper.svelte';

type MountedComponent = ReturnType<typeof mount>;

describe('NuiFileInput - mode switching, URL lifecycle, and state synchronization', () => {
  let container: HTMLElement;
  let createdUrls: Set<string>;
  let revokedUrls: Set<string>;
  let mountedApps: MountedComponent[] = [];

  function unmountApp(instance: MountedComponent): void {
    const idx = mountedApps.indexOf(instance);
    if (idx !== -1) {
      mountedApps.splice(idx, 1);
    }
    unmount(instance);
  }

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    createdUrls = new Set();
    revokedUrls = new Set();

    let urlCounter = 0;

    // Ensure methods exist on URL in headless/happy-dom environments
    if (typeof URL.createObjectURL !== 'function') {
      URL.createObjectURL = () => '';
    }
    if (typeof URL.revokeObjectURL !== 'function') {
      URL.revokeObjectURL = () => {};
    }

    vi.spyOn(URL, 'createObjectURL').mockImplementation((obj: Blob | MediaSource) => {
      const name = obj instanceof File ? obj.name : 'blob';
      const url = `blob:mock-url-${++urlCounter}-${name}`;
      createdUrls.add(url);
      return url;
    });

    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url: string) => {
      revokedUrls.add(url);
    });
  });

  afterEach(() => {
    while (mountedApps.length > 0) {
      const app = mountedApps.pop()!;
      unmount(app);
    }
    container.remove();
    vi.restoreAllMocks();
  });

  function createFileInput(config: MountFileInputConfig = {}) {
    const helper = mountFileInput(container, config);
    mountedApps.push(helper.instance);
    return helper;
  }

  it('switches multiple from true to false: truncates to first file and revokes only extra URLs', () => {
    const fileA = new File(['contentA'], 'photoA.png', { type: 'image/png' });
    const fileB = new File(['contentB'], 'photoB.png', { type: 'image/png' });
    const fileC = new File(['contentC'], 'photoC.png', { type: 'image/png' });

    let isMultiple = true;

    const { getValue, getFiles, instance, update } = createFileInput({
      value: [fileA, fileB, fileC],
      multiple: () => isMultiple,
      showPreview: true
    });

    // In multiple mode with 3 images, 3 ObjectURLs should be generated
    const initialFiles = getFiles();
    expect(initialFiles.length).toBe(3);
    const urlA = initialFiles[0].url!;
    const urlB = initialFiles[1].url!;
    const urlC = initialFiles[2].url!;

    expect(createdUrls.has(urlA)).toBe(true);
    expect(createdUrls.has(urlB)).toBe(true);
    expect(createdUrls.has(urlC)).toBe(true);

    // Dynamic switch to multiple = false
    isMultiple = false;
    update();

    // Value should be normalized to single fileA
    expect(getValue()).toBe(fileA);
    const updatedFiles = getFiles();
    expect(updatedFiles.length).toBe(1);
    expect(updatedFiles[0].name).toBe('photoA.png');

    // urlA MUST be preserved (not revoked)
    expect(revokedUrls.has(urlA)).toBe(false);
    expect(updatedFiles[0].url).toBe(urlA);

    // Extra URLs for fileB and fileC MUST be revoked
    expect(revokedUrls.has(urlB)).toBe(true);
    expect(revokedUrls.has(urlC)).toBe(true);

    unmountApp(instance);
    // On unmount, urlA is finally revoked
    expect(revokedUrls.has(urlA)).toBe(true);
  });

  it('switches multiple from false to true: wraps single file in array without re-creating URLs', () => {
    const fileA = new File(['contentA'], 'avatar.jpg', { type: 'image/jpeg' });
    let isMultiple = false;

    const { getValue, getFiles, instance, update } = createFileInput({
      value: fileA,
      multiple: () => isMultiple,
      showPreview: true
    });

    expect(getFiles().length).toBe(1);
    const urlA = getFiles()[0].url!;
    expect(createdUrls.has(urlA)).toBe(true);

    // Dynamic switch to multiple = true
    isMultiple = true;
    update();

    const currentVal = getValue();
    expect(Array.isArray(currentVal)).toBe(true);
    expect(currentVal).toEqual([fileA]);
    expect(getFiles().length).toBe(1);
    // urlA is preserved and not revoked
    expect(revokedUrls.has(urlA)).toBe(false);
    expect(getFiles()[0].url).toBe(urlA);

    unmountApp(instance);
  });

  it('dynamically toggles showPreview: creates URLs on enable, revokes on disable', () => {
    const fileImg = new File(['image'], 'banner.png', { type: 'image/png' });
    let previewEnabled = false;

    const { getFiles, instance, update } = createFileInput({
      value: fileImg,
      showPreview: () => previewEnabled
    });

    // With showPreview = false, no ObjectURL is created
    expect(getFiles().length).toBe(1);
    expect(getFiles()[0].url).toBeUndefined();
    expect(createdUrls.size).toBe(0);

    // Toggle showPreview to true
    previewEnabled = true;
    update();

    expect(getFiles()[0].url).toBeDefined();
    const createdUrl = getFiles()[0].url!;
    expect(createdUrls.has(createdUrl)).toBe(true);
    expect(revokedUrls.has(createdUrl)).toBe(false);

    // Toggle showPreview back to false
    previewEnabled = false;
    update();

    expect(revokedUrls.has(createdUrl)).toBe(true);
    expect(getFiles()[0].url).toBeUndefined();

    unmountApp(instance);
  });

  it('cleans up all ObjectURLs on external value reset', () => {
    const fileA = new File(['a'], 'a.png', { type: 'image/png' });
    const fileB = new File(['b'], 'b.png', { type: 'image/png' });

    const { getFiles, setValue, instance } = createFileInput({
      value: [fileA, fileB],
      multiple: true,
      showPreview: true
    });

    expect(getFiles().length).toBe(2);
    const urlA = getFiles()[0].url!;
    const urlB = getFiles()[1].url!;

    // External reset by parent: value = []
    setValue([]);

    expect(getFiles().length).toBe(0);
    expect(revokedUrls.has(urlA)).toBe(true);
    expect(revokedUrls.has(urlB)).toBe(true);

    unmountApp(instance);
  });

  it('sends FileMetadata without blob URLs to NUI client and fires onChange on user selection', () => {
    const fileA = new File(['a'], 'doc.pdf', { type: 'application/pdf' });
    const mockSend = vi.fn();
    const mockOnChange = vi.fn();
    const mockClient = { send: mockSend };

    const { selectFiles, instance } = createFileInput({
      value: null,
      eventName: 'nui:upload',
      client: mockClient,
      onChange: mockOnChange,
      showPreview: true
    });

    selectFiles([fileA]);

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    const changedFiles = mockOnChange.mock.calls[0][0];
    expect(changedFiles.length).toBe(1);
    expect(changedFiles[0].name).toBe('doc.pdf');

    expect(mockSend).toHaveBeenCalledTimes(1);
    const [sentEvent, payload] = mockSend.mock.calls[0];
    expect(sentEvent).toBe('nui:upload');
    expect(payload.count).toBe(1);

    // Payload must NOT contain browser ObjectURL
    const fileMetadata: FileMetadata = payload.fileInfos[0];
    expect(fileMetadata.name).toBe('doc.pdf');
    expect(fileMetadata.type).toBe('application/pdf');
    expect('url' in fileMetadata).toBe(false);

    unmountApp(instance);
  });

  it('normalizes value array by stripping non-File elements and deduplicating identical File instances', () => {
    const fileA = new File(['a'], 'a.txt', { type: 'text/plain' });
    const fileB = new File(['b'], 'b.txt', { type: 'text/plain' });

    const { getValue, getFiles, instance } = createFileInput({
      value: [fileA, null, fileA, fileB, undefined] as unknown as File[],
      multiple: true,
      showPreview: false
    });

    // Value should be normalized to strictly deduplicated [fileA, fileB]
    expect(getValue()).toEqual([fileA, fileB]);
    expect(getFiles().length).toBe(2);
    expect(getFiles()[0].name).toBe('a.txt');
    expect(getFiles()[1].name).toBe('b.txt');

    // Each FileInfo must possess a distinct, unique id
    expect(getFiles()[0].id).toBeDefined();
    expect(getFiles()[1].id).toBeDefined();
    expect(getFiles()[0].id).not.toBe(getFiles()[1].id);

    unmountApp(instance);
  });

  it('accepts application/octet-stream generic MIME type via file extension fallback', () => {
    const pdfFile = new File(['%PDF-1.4'], 'contract.pdf', { type: 'application/octet-stream' });

    const { getValue, getFiles, selectFiles, instance } = createFileInput({
      value: null,
      accept: 'application/pdf',
      showPreview: false
    });

    selectFiles([pdfFile]);

    // Despite file.type being application/octet-stream, contract.pdf is accepted via extension
    expect(getValue()).toBe(pdfFile);
    expect(getFiles().length).toBe(1);
    expect(getFiles()[0].name).toBe('contract.pdf');

    unmountApp(instance);
  });

  it('rejects files not matching accept pattern and shows accessible validation alert', () => {
    const textFile = new File(['text'], 'notes.txt', { type: 'text/plain' });
    const mockSend = vi.fn();
    const mockOnChange = vi.fn();

    const { getValue, getFiles, selectFiles, instance } = createFileInput({
      value: null,
      accept: 'image/*,.pdf',
      eventName: 'nui:upload',
      client: { send: mockSend },
      onChange: mockOnChange
    });

    selectFiles([textFile]);

    // File should not be accepted
    expect(getValue()).toBeNull();
    expect(getFiles().length).toBe(0);
    expect(mockOnChange).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();

    // Accessible error alert should be rendered
    const errorEl = container.querySelector('.nui-file-input__error');
    expect(errorEl).not.toBeNull();
    expect(errorEl?.getAttribute('role')).toBe('alert');
    expect(container.querySelector('.nui-file-input__dropzone')?.classList.contains('is-invalid')).toBe(true);

    unmountApp(instance);
  });

  it('rejects files exceeding maxSize limit without firing onChange or client.send', () => {
    // 2 MB file with maxSize of 1 MB without allocating memory buffer
    const largeFile = new File(['x'], 'large.png', { type: 'image/png' });
    Object.defineProperty(largeFile, 'size', { value: 2 * 1024 * 1024 });

    const mockSend = vi.fn();
    const mockOnChange = vi.fn();

    const { getValue, getFiles, selectFiles, instance } = createFileInput({
      value: null,
      maxSize: 1024 * 1024, // 1 MB limit
      eventName: 'nui:upload',
      client: { send: mockSend },
      onChange: mockOnChange
    });

    selectFiles([largeFile]);

    expect(getValue()).toBeNull();
    expect(getFiles().length).toBe(0);
    expect(mockOnChange).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();

    const errorEl = container.querySelector('.nui-file-input__error');
    expect(errorEl).not.toBeNull();
    expect(errorEl?.getAttribute('role')).toBe('alert');

    unmountApp(instance);
  });

  it('serializes NUI metadata directly from internal items, decoupled from external files mutation', () => {
    const fileA = new File(['a'], 'data.csv', { type: 'text/csv' });
    const mockSend = vi.fn();
    const mockClient = { send: mockSend };

    const { selectFiles, setFiles, getFiles, instance } = createFileInput({
      value: null,
      eventName: 'nui:csvUploaded',
      client: mockClient
    });

    selectFiles([fileA]);

    expect(mockSend).toHaveBeenCalledTimes(1);
    const [, payload] = mockSend.mock.calls[0];

    const filesBeforeReset = getFiles();
    expect(payload.fileInfos).not.toBe(filesBeforeReset);
    const payloadCopyBeforeReset = JSON.parse(JSON.stringify(payload));

    // External parent mutates files array to empty
    setFiles([]);

    // Sent payload remains intact and decoupled
    expect(getFiles().length).toBe(0);
    expect(payload.fileInfos).not.toBe(getFiles());
    expect(payload).toEqual(payloadCopyBeforeReset);
    expect(payload.count).toBe(1);
    expect(payload.fileInfos[0].name).toBe('data.csv');
    expect(payload.fileInfos[0].type).toBe('text/csv');

    unmountApp(instance);
  });

  it('decreases value after maxFiles error: externalLimitError clears automatically', () => {
    const fileA = new File(['a'], 'a.txt', { type: 'text/plain' });
    const fileB = new File(['b'], 'b.txt', { type: 'text/plain' });
    const fileC = new File(['c'], 'c.txt', { type: 'text/plain' });

    const { getFiles, setValue, instance } = createFileInput({
      value: [fileA, fileB, fileC],
      multiple: true,
      maxFiles: 2,
      showPreview: false
    });

    // Limit exceeded (3 > 2), so error should be rendered
    const errorEl = container.querySelector('.nui-file-input__error');
    expect(errorEl).not.toBeNull();
    expect(errorEl?.getAttribute('role')).toBe('alert');
    expect(container.querySelector('.nui-file-input__dropzone')?.classList.contains('is-invalid')).toBe(true);

    // Parent reduces value to 2 files
    setValue([fileA, fileB]);

    // Error should be automatically cleared
    expect(container.querySelector('.nui-file-input__error')).toBeNull();
    expect(container.querySelector('.nui-file-input__dropzone')?.classList.contains('is-invalid')).toBe(false);
    expect(getFiles().length).toBe(2);

    unmountApp(instance);
  });

  it('dynamically updates maxFiles at runtime without destructively truncating files', () => {
    const fileA = new File(['a'], 'a.txt', { type: 'text/plain' });
    const fileB = new File(['b'], 'b.txt', { type: 'text/plain' });
    const fileC = new File(['c'], 'c.txt', { type: 'text/plain' });

    let currentMaxFiles = 5;

    const { getValue, getFiles, instance, update } = createFileInput({
      value: [fileA, fileB, fileC],
      maxFiles: () => currentMaxFiles,
      multiple: true,
      showPreview: false
    });

    // 3 files <= maxFiles 5: no error
    expect(container.querySelector('.nui-file-input__error')).toBeNull();
    expect(getFiles().length).toBe(3);

    // Dynamically decrease maxFiles to 2 (less than current file count)
    currentMaxFiles = 2;
    update();

    // Error appears, but files are NOT truncated
    const errorEl = container.querySelector('.nui-file-input__error');
    expect(errorEl).not.toBeNull();
    expect(errorEl?.getAttribute('role')).toBe('alert');
    expect(getFiles().length).toBe(3);
    expect(getValue()).toEqual([fileA, fileB, fileC]);

    // Dynamically increase maxFiles to 4
    currentMaxFiles = 4;
    update();

    // Error clears automatically
    expect(container.querySelector('.nui-file-input__error')).toBeNull();
    expect(container.querySelector('.nui-file-input__dropzone')?.classList.contains('is-invalid')).toBe(false);

    unmountApp(instance);
  });

  it('does not allow file selection when disabled, with control case verifying enabled accepts', () => {
    const fileA = new File(['a'], 'avatar.png', { type: 'image/png' });
    const mockSend = vi.fn();
    const mockOnChange = vi.fn();

    const { getValue, getFiles, selectFiles, instance } = createFileInput({
      value: null,
      disabled: true,
      eventName: 'nui:upload',
      client: { send: mockSend },
      onChange: mockOnChange
    });

    selectFiles([fileA]);

    // Selection should be completely blocked
    expect(getValue()).toBeNull();
    expect(getFiles().length).toBe(0);
    expect(mockOnChange).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();

    unmountApp(instance);

    // Control case: identical scenario with disabled: false accepts file and fires callbacks
    const controlSend = vi.fn();
    const controlOnChange = vi.fn();
    const control = createFileInput({
      value: null,
      disabled: false,
      eventName: 'nui:upload',
      client: { send: controlSend },
      onChange: controlOnChange
    });

    control.selectFiles([fileA]);

    expect(control.getValue()).toBe(fileA);
    expect(control.getFiles().length).toBe(1);
    expect(control.getFiles()[0].name).toBe('avatar.png');
    expect(controlOnChange).toHaveBeenCalledTimes(1);
    expect(controlSend).toHaveBeenCalledTimes(1);

    unmountApp(control.instance);
  });

  it('does not generate ObjectURL for non-image files even when showPreview is true', () => {
    const docFile = new File(['content'], 'archive.zip', { type: 'application/zip' });

    const { getFiles, instance } = createFileInput({
      value: docFile,
      showPreview: true
    });

    expect(getFiles().length).toBe(1);
    expect(getFiles()[0].name).toBe('archive.zip');
    // Non-image files should have no preview URL
    expect(getFiles()[0].url).toBeUndefined();
    expect(createdUrls.size).toBe(0);

    unmountApp(instance);
  });

  it('removes file and allows re-adding the exact same File instance', () => {
    const fileA = new File(['a'], 'avatar.png', { type: 'image/png' });

    const { getValue, getFiles, selectFiles, instance, update } = createFileInput({
      value: fileA,
      multiple: false,
      showPreview: true
    });

    expect(getValue()).toBe(fileA);
    expect(getFiles().length).toBe(1);
    const initialId = getFiles()[0].id;
    const initialUrl = getFiles()[0].url!;
    expect(createdUrls.has(initialUrl)).toBe(true);

    // User clicks remove button
    const removeBtn = container.querySelector<HTMLButtonElement>('.nui-file-input__remove')!;
    expect(removeBtn).not.toBeNull();
    removeBtn.click();
    update();

    expect(getValue()).toBeNull();
    expect(getFiles().length).toBe(0);
    expect(revokedUrls.has(initialUrl)).toBe(true);

    // User re-selects the exact same File instance
    selectFiles([fileA]);

    expect(getValue()).toBe(fileA);
    expect(getFiles().length).toBe(1);
    expect(getFiles()[0].id).toBeDefined();
    // New entry should have a new unique ID and newly generated URL
    expect(getFiles()[0].id).not.toBe(initialId);
    const newUrl = getFiles()[0].url!;
    expect(newUrl).not.toBe(initialUrl);
    expect(createdUrls.has(newUrl)).toBe(true);
    expect(revokedUrls.has(newUrl)).toBe(false);

    unmountApp(instance);
    expect(revokedUrls.has(newUrl)).toBe(true);
  });

  it('does not trigger onChange or client.send during external value synchronization', () => {
    const fileA = new File(['a'], 'docA.txt', { type: 'text/plain' });
    const fileB = new File(['b'], 'docB.txt', { type: 'text/plain' });

    const mockOnChange = vi.fn();
    const mockSend = vi.fn();
    const mockClient = { send: mockSend };

    const { getFiles, setValue, instance } = createFileInput({
      value: null,
      multiple: true,
      eventName: 'nui:syncEvent',
      client: mockClient,
      onChange: mockOnChange,
      showPreview: false
    });

    // 1. External programmatic set to [fileA]
    setValue([fileA]);

    expect(getFiles().length).toBe(1);
    expect(mockOnChange).toHaveBeenCalledTimes(0);
    expect(mockSend).toHaveBeenCalledTimes(0);

    // 2. External programmatic set to [fileA, fileB]
    setValue([fileA, fileB]);

    expect(getFiles().length).toBe(2);
    expect(mockOnChange).toHaveBeenCalledTimes(0);
    expect(mockSend).toHaveBeenCalledTimes(0);

    // 3. External programmatic reset to []
    setValue([]);

    expect(getFiles().length).toBe(0);
    expect(mockOnChange).toHaveBeenCalledTimes(0);
    expect(mockSend).toHaveBeenCalledTimes(0);

    unmountApp(instance);
  });
});
