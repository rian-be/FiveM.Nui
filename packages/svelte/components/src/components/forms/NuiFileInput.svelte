<!--
  @component NuiFileInput
  Accessible file input component conforming to W3C standards with drag-and-drop,
  per-file size constraints, total file count limits, reactive preview generation,
  memory leak-free ObjectURL management, and FiveM NUI event synchronization.

  Important note for FiveM NUI:
  Due to CEF browser sandbox and JSON serialization boundaries, the NUI event transport
  sends clean file metadata (FileMetadata: id, name, size, type), NOT temporary browser
  ObjectURLs ('blob:...') nor binary file contents. If the C# FiveM resource requires raw
  file content, serialize it via FileReader (ArrayBuffer/base64) before transmission.
  Client-side 'accept' and size validation serve as immediate UX guards; server/resource
  handlers should always independently re-validate transmitted file data.
-->
<script module lang="ts">
  export type { FileInfo, FileMetadata } from "./NuiFileInput.types";
</script>

<script lang="ts">
  import { onDestroy } from "svelte";
  import { nui } from "@fivem-nui/svelte";
  import type { SvelteNuiClient } from "@fivem-nui/svelte";
  import type { FileInfo, FileMetadata } from "./NuiFileInput.types";

  interface Props {
    /** Optional HTML id attribute. Auto-generated via $props.id() if omitted. */
    id?: string;
    /** Form input name attribute. */
    name?: string;
    /** Visual label text displayed above the control. */
    label?: string;
    /** Secondary description text displayed below label. */
    description?: string;
    /**
     * Accepted file types, e.g. "image/*", ".pdf", "image/png,image/jpeg".
     * Validates both MIME types and file extensions with fallback for empty MIME types.
     * Evaluated during user interactions (file picker, drag & drop).
     * Defaults to empty string (all file types accepted).
     */
    accept?: string;
    /**
     * Whether multiple file selection is enabled. Defaults to false.
     * If dynamically switched at runtime, values are automatically normalized.
     */
    multiple?: boolean;
    /**
     * Maximum allowed file size in bytes per single file. Must be > 0.
     * Evaluated during user interactions (file picker, drag & drop).
     */
    maxSize?: number;
    /**
     * Maximum allowed total number of files when multiple=true. Must be > 0.
     * Evaluated during user interactions (file picker, drag & drop) and reactively derived
     * as an external limit error if the parent supplies or configures a limit lower than
     * the current file count (without destructively truncating the parent's external data).
     */
    maxFiles?: number;
    /**
     * Selected raw DOM File object or array of File objects.
     * Serves as the single canonical source of truth for selected files.
     * When multiple=false: File | null.
     * When multiple=true: File[].
     * Supports two-way binding.
     */
    value?: File | File[] | null;
    /**
     * Read-only metadata array of all currently selected files.
     * Represents the active UI metadata, including temporary ObjectURLs when showPreview=true.
     * Supports two-way binding.
     */
    files?: FileInfo[];
    /** Whether the file input is disabled. */
    disabled?: boolean;
    /** Placeholder prompt text displayed in the dropzone when no files are chosen. */
    placeholder?: string;
    /** Whether to render preview list and generate image ObjectURLs. Defaults to true. */
    showPreview?: boolean;
    /** Accessible label for screen readers when visual label is omitted. */
    ariaLabel?: string;
    /** External validation error message displayed below the input. */
    error?: string;
    /**
     * Optional NUI event name sent on file addition/removal.
     * Transmits clean FileMetadata ({ fileInfos: FileMetadata[], count }).
     */
    eventName?: string;
    /**
     * Callback fired when the user adds or removes files through UI interactions
     * (native file picker dialog, drag-and-drop, or remove button).
     * Does not fire on external programmatic changes to the `value` prop to prevent circular update loops.
     */
    onChange?: (files: FileInfo[], rawFiles: File | File[] | null) => void;
    /** Callback fired when validation fails (e.g. exceeds maxSize or maxFiles). */
    onError?: (errorMessage: string) => void;
    /** SvelteNuiClient instance for event transport. */
    client?: SvelteNuiClient;
  }

  const autoId = $props.id();

  let {
    id,
    name,
    label = "File",
    description,
    accept = "",
    multiple = false,
    maxSize,
    maxFiles,
    value = $bindable(multiple ? [] : null),
    files = $bindable([] as FileInfo[]),
    disabled = false,
    placeholder = "Click or drag files here",
    showPreview = true,
    ariaLabel,
    error = "",
    eventName = "",
    onChange,
    onError,
    client = nui,
  }: Props = $props();

  // Internal representation coupling DOM File objects with FileInfo metadata
  let items = $state<Array<{ id: string; file: File; info: FileInfo }>>([]);
  // Registry tracking generated ObjectURLs keyed by file entry ID
  const createdUrls = new Map<string, string>();

  let interactionError = $state("");
  let isDragOver = $state(false);

  const controlId = $derived(id || autoId);
  const inputId = $derived(`${controlId}-input`);
  const labelId = $derived(label ? `${controlId}-label` : undefined);
  const descId = $derived(description ? `${controlId}-desc` : undefined);

  // Automatically derived validation error when selected files count exceeds maxFiles
  const externalLimitError = $derived.by(() => {
    if (multiple && isMaxFilesValid && maxFiles && items.length > maxFiles) {
      return `File count (${items.length}) exceeds the maximum limit of ${maxFiles}.`;
    }
    return "";
  });

  const effectiveError = $derived(
    error || interactionError || externalLimitError,
  );
  const errorId = $derived(effectiveError ? `${controlId}-error` : undefined);
  const resolvedAriaLabel = $derived(
    !label ? ariaLabel || placeholder : undefined,
  );
  const describedBy = $derived(
    [descId, errorId].filter(Boolean).join(" ") || undefined,
  );

  // Validate numeric limits (ignoring non-finite, zero or negative values)
  const isMaxSizeValid = $derived(
    typeof maxSize === "number" && Number.isFinite(maxSize) && maxSize > 0,
  );
  const isMaxFilesValid = $derived(
    typeof maxFiles === "number" && Number.isFinite(maxFiles) && maxFiles > 0,
  );

  /** Formats bytes into a human-readable string up to PB. */
  function formatSize(bytes: number): string {
    if (bytes <= 0 || !Number.isFinite(bytes)) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
    const i = Math.min(
      Math.floor(Math.log(bytes) / Math.log(k)),
      sizes.length - 1,
    );
    const val = bytes / Math.pow(k, i);
    return `${val >= 100 ? val.toFixed(0) : val >= 10 ? val.toFixed(1) : val.toFixed(2)} ${sizes[i]}`;
  }

  /** Pluralization helper for file count. */
  function filePluralText(count: number): string {
    return count === 1 ? "file selected" : "files selected";
  }

  /** Returns an emoji icon reflecting the MIME type of a file. */
  //TODO change icons to font Awesome
  function getFileIcon(mimeType: string): string {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType.startsWith("audio/")) return "audio";
    if (mimeType.includes("pdf")) return "pdf";
    if (
      mimeType.includes("zip") ||
      mimeType.includes("compressed") ||
      mimeType.includes("tar")
    )
      return "archive";
    if (
      mimeType.startsWith("text/") ||
      mimeType.includes("json") ||
      mimeType.includes("xml")
    )
      return "document";
    return "file";
  }

  const hintText = $derived.by(() => {
    const parts: string[] = [];
    if (accept) parts.push(accept);
    if (isMaxSizeValid && maxSize)
      parts.push(`Max. ${formatSize(maxSize)} / file`);
    if (multiple && isMaxFilesValid && maxFiles)
      parts.push(`Max. ${maxFiles} files`);
    return parts.join(" • ");
  });

  const MIME_EXT_FALLBACKS: Record<string, string[]> = {
    "image/*": [
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".webp",
      ".svg",
      ".bmp",
      ".ico",
      ".avif",
    ],
    "video/*": [".mp4", ".webm", ".ogg", ".mov", ".avi", ".mkv"],
    "audio/*": [".mp3", ".wav", ".ogg", ".aac", ".flac", ".m4a"],
    "application/pdf": [".pdf"],
    "text/plain": [".txt", ".log"],
  };

  /**
   * Duck-typing guard for File and File-like objects.
   * Validates that the object implements the core File interface properties (name, size, type, slice),
   * supporting native File instances as well as cross-realm / iframe File-like implementations.
   */
  function isFileLike(val: unknown): val is File {
    if (!val || typeof val !== "object") return false;
    if (typeof File !== "undefined" && val instanceof File) return true;
    return (
      typeof (val as File).name === "string" &&
      typeof (val as File).size === "number" &&
      typeof (val as File).type === "string" &&
      typeof (val as File).slice === "function"
    );
  }

  /** Validates whether a file matches accept rules with fallback for empty or generic MIME types. */
  function isFileTypeAccepted(file: File, rules: string[]): boolean {
    if (rules.length === 0) return true;
    const fileName = file.name.toLowerCase();
    const fileType = file.type ? file.type.toLowerCase() : "";
    const isGenericMime = !fileType || fileType === "application/octet-stream";

    return rules.some((rule) => {
      // 1. File extension rule, eg. '.pdf'
      if (rule.startsWith(".")) {
        return fileName.endsWith(rule);
      }

      if (fileType && fileType === rule) {
        return true;
      }

      // 3. Wildcard MIME match, eg. 'image/*'
      if (rule.endsWith("/*")) {
        const prefix = rule.slice(0, -2);
        if (fileType && fileType.startsWith(prefix)) {
          return true;
        }
      }

      // Fallback for empty or generic (application/octet-stream) MIME types based on extension
      if (isGenericMime) {
        const fallbacks = MIME_EXT_FALLBACKS[rule];
        if (fallbacks && fallbacks.some((ext) => fileName.endsWith(ext))) {
          return true;
        }
      }

      return false;
    });
  }

  function createItem(file: File): { id: string; file: File; info: FileInfo } {
    const itemId = `nui-file-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    let url: string | undefined;

    if (
      showPreview &&
      file.type.startsWith("image/") &&
      typeof URL !== "undefined"
    ) {
      try {
        url = URL.createObjectURL(file);
        createdUrls.set(itemId, url);
      } catch {
        url = undefined;
      }
    }

    const info: FileInfo = {
      id: itemId,
      name: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
      url,
    };

    return { id: itemId, file, info };
  }

  function revokeItemUrl(itemId: string) {
    const url = createdUrls.get(itemId);
    if (url && typeof URL !== "undefined") {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore cleanup error
      }
      createdUrls.delete(itemId);
    }
  }

  function revokeAllUrls() {
    if (typeof URL !== "undefined") {
      for (const url of createdUrls.values()) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore cleanup error
        }
      }
    }
    createdUrls.clear();
  }

  /**
   * Synchronize state when 'value' or 'multiple' is externally updated by parent component.
   * Treats 'value' as the canonical single source of truth, normalizes types, and deduplicates.
   */
  $effect(() => {
    // 1. Single-file mode (multiple = false)
    if (!multiple) {
      let targetFile: File | null = null;
      if (isFileLike(value)) {
        targetFile = value;
      } else if (Array.isArray(value) && value.length > 0) {
        const validFirst = value.find(isFileLike);
        targetFile = validFirst ?? null;
        value = targetFile;
      } else if (value !== null) {
        value = null;
      }

      const currentFile = items[0]?.file ?? null;
      const needsSync =
        targetFile !== currentFile || items.length !== (targetFile ? 1 : 0);

      if (needsSync) {
        interactionError = "";
        if (targetFile && targetFile === currentFile && items.length > 1) {
          for (let i = 1; i < items.length; i++) {
            revokeItemUrl(items[i].id);
          }
          items = [items[0]];
          files = [items[0].info];
        } else {
          revokeAllUrls();
          if (targetFile) {
            const item = createItem(targetFile);
            items = [item];
            files = [item.info];
          } else {
            items = [];
            files = [];
          }
        }
      }
      return;
    }

    let targetFiles: File[] = [];
    if (Array.isArray(value)) {
      const incomingArray = value;
      const validFiles = incomingArray.filter(isFileLike);
      // Deduplicate identical File instances to maintain unique keys and prevent duplicate IDs
      targetFiles = Array.from(new Set(validFiles));

      if (
        targetFiles.length !== incomingArray.length ||
        targetFiles.some((f, idx) => f !== incomingArray[idx])
      ) {
        value = targetFiles;
      }
    } else if (isFileLike(value)) {
      // Mode switched from single: wrap existing File in array
      targetFiles = [value];
      value = targetFiles;
    } else if (value !== null) {
      // Normalize invalid scalar or undefined to empty array for multiple mode
      value = [];
      targetFiles = [];
    } else {
      value = [];
      targetFiles = [];
    }

    const currentFiles = items.map((it) => it.file);
    const isIdentical =
      targetFiles.length === currentFiles.length &&
      targetFiles.every((f, idx) => f === currentFiles[idx]);

    if (!isIdentical) {
      interactionError = "";
      const targetSet = new Set(targetFiles);

      // Clean up URLs for removed files
      for (const item of items) {
        if (!targetSet.has(item.file)) {
          revokeItemUrl(item.id);
        }
      }

      // Preserve existing items for matching files to avoid re-creating object URLs
      const existingByFile = new Map<
        File,
        { id: string; file: File; info: FileInfo }
      >();
      for (const item of items) {
        if (targetSet.has(item.file) && !existingByFile.has(item.file)) {
          existingByFile.set(item.file, item);
        }
      }

      const nextItems = targetFiles.map((file) => {
        const existing = existingByFile.get(file);
        if (existing) {
          existingByFile.delete(file);
          return existing;
        }
        return createItem(file);
      });

      items = nextItems;
      files = nextItems.map((it) => it.info);
    }
  });

  /**
   * Reactively manage ObjectURL resource lifecycle when 'showPreview' prop changes.
   * Generates URLs if enabled, or immediately revokes them to prevent memory waste if disabled.
   */
  $effect(() => {
    if (showPreview) {
      let changed = false;
      for (const item of items) {
        if (
          item.file.type.startsWith("image/") &&
          !item.info.url &&
          typeof URL !== "undefined"
        ) {
          try {
            const url = URL.createObjectURL(item.file);
            createdUrls.set(item.id, url);
            item.info.url = url;
            changed = true;
          } catch {
            // ignore preview generation error
          }
        }
      }
      if (changed) {
        files = items.map((it) => it.info);
      }
    } else {
      if (createdUrls.size > 0) {
        revokeAllUrls();
        for (const item of items) {
          item.info.url = undefined;
        }
        files = items.map((it) => it.info);
      }
    }
  });

  onDestroy(() => {
    revokeAllUrls();
  });

  function sendNuiEvent() {
    if (!eventName) return;
    try {
      // Build clean metadata directly from internal authoritative items (decoupled from bindable files)
      const fileInfos: FileMetadata[] = items.map(({ info }) => ({
        id: info.id,
        name: info.name,
        size: info.size,
        type: info.type,
      }));

      const res = client.send(eventName, {
        fileInfos,
        count: fileInfos.length,
      }) as unknown;

      // Handle cases where client.send returns a Promise (e.g. custom or mock clients)
      if (res && typeof (res as Promise<unknown>).catch === "function") {
        (res as Promise<unknown>).catch((err: unknown) => {
          console.error(
            `[fivem-nui-components] Async error sending file input event '${eventName}':`,
            err,
          );
        });
      }
    } catch (err) {
      console.error(
        `[fivem-nui-components] Failed to send file input event '${eventName}':`,
        err,
      );
    }
  }

  function processFiles(incomingFiles: File[]) {
    interactionError = "";

    if (disabled || incomingFiles.length === 0) return;

    // Reject multiple files in single-file mode
    if (!multiple && incomingFiles.length > 1) {
      interactionError =
        "Only a single file can be selected in single-file mode.";
      onError?.(interactionError);
      return;
    }

    // 1. Validate accept constraint if specified
    if (accept) {
      const acceptRules = accept
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

      if (acceptRules.length > 0) {
        const invalidFile = incomingFiles.find(
          (f) => !isFileTypeAccepted(f, acceptRules),
        );
        if (invalidFile) {
          interactionError = `Invalid file format: "${invalidFile.name}". Allowed: ${accept}`;
          onError?.(interactionError);
          return;
        }
      }
    }

    // 2. Validate maxSize (per-file limit)
    if (isMaxSizeValid && maxSize) {
      const tooLarge = incomingFiles.find((f) => f.size > maxSize);
      if (tooLarge) {
        interactionError = `File "${tooLarge.name}" (${formatSize(tooLarge.size)}) exceeds maximum size limit (${formatSize(maxSize)}).`;
        onError?.(interactionError);
        return;
      }
    }

    // 3. Validate maxFiles (cumulative total count in multiple mode)
    if (multiple && isMaxFilesValid && maxFiles) {
      const totalCount = items.length + incomingFiles.length;
      if (totalCount > maxFiles) {
        interactionError = `File limit exceeded (${maxFiles}). Currently selected: ${items.length}, attempted to add: ${incomingFiles.length}.`;
        onError?.(interactionError);
        return;
      }
    }

    // 4. Update items and value
    if (!multiple) {
      // In single mode, revoke old URLs BEFORE creating the new item's URL
      revokeAllUrls();
      const newItem = createItem(incomingFiles[0]);
      items = [newItem];
      files = [newItem.info];
      value = newItem.file;
    } else {
      const newItems = incomingFiles.map((f) => createItem(f));
      items = [...items, ...newItems];
      files = items.map((it) => it.info);
      value = items.map((it) => it.file);
    }

    sendNuiEvent();
    onChange?.(files, value);
  }

  function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const selected = Array.from(input.files ?? []);
    input.value = "";
    if (selected.length === 0) return;
    processFiles(selected);
  }

  function removeFile(index: number) {
    if (disabled || index < 0 || index >= items.length) return;

    interactionError = "";
    const itemToRemove = items[index];
    if (itemToRemove) {
      revokeItemUrl(itemToRemove.id);
    }

    const nextItems = items.filter((_, i) => i !== index);
    items = nextItems;

    if (multiple) {
      files = nextItems.map((it) => it.info);
      value = nextItems.map((it) => it.file);
    } else {
      files = [];
      value = null;
    }

    sendNuiEvent();
    onChange?.(files, value);
  }

  function handleDragOver(event: DragEvent) {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    isDragOver = true;
  }

  function handleDragEnter(event: DragEvent) {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    isDragOver = true;
  }

  function handleDragLeave(event: DragEvent) {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget === event.target) {
      isDragOver = false;
    }
  }

  function handleDrop(event: DragEvent) {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    isDragOver = false;

    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(event.dataTransfer.files);
      processFiles(droppedFiles);
    }
  }
</script>

<div class="nui-file-input" class:is-disabled={disabled}>
  {#if label}
    <label class="nui-file-input__label" id={labelId} for={inputId}>
      {label}
    </label>
  {/if}

  {#if description}
    <span class="nui-file-input__description" id={descId}>
      {description}
    </span>
  {/if}

  <label
    class="nui-file-input__dropzone"
    class:is-dragover={isDragOver}
    class:is-disabled={disabled}
    class:is-invalid={Boolean(effectiveError)}
    for={inputId}
    ondragover={handleDragOver}
    ondragenter={handleDragEnter}
    ondragleave={handleDragLeave}
    ondrop={handleDrop}
  >
    <input
      id={inputId}
      type="file"
      class="nui-file-input__native"
      {name}
      accept={accept || undefined}
      {multiple}
      {disabled}
      onchange={handleFileChange}
      aria-labelledby={labelId}
      aria-label={labelId ? undefined : resolvedAriaLabel}
      aria-describedby={describedBy}
      aria-invalid={effectiveError ? "true" : undefined}
    />

    <div class="nui-file-input__control">
      <span class="nui-file-input__icon" aria-hidden="true">📎</span>
      <div class="nui-file-input__content">
        <span class="nui-file-input__text">
          {#if items.length > 0}
            {items.length} {filePluralText(items.length)}
          {:else}
            {placeholder}
          {/if}
        </span>
        {#if hintText}
          <span class="nui-file-input__hint">{hintText}</span>
        {/if}
      </div>
      {#if !disabled}
        <span class="nui-file-input__action-btn" aria-hidden="true">
          Browse
        </span>
      {/if}
    </div>
  </label>

  {#if effectiveError}
    <div
      class="nui-file-input__error"
      id={errorId}
      role="alert"
      aria-live="polite"
    >
      <span class="nui-file-input__error-icon" aria-hidden="true">⚠️</span>
      <span>{effectiveError}</span>
    </div>
  {/if}

  {#if items.length > 0 && showPreview}
    <ul class="nui-file-input__preview" aria-label="Selected files">
      {#each items as item, i (item.id)}
        <li class="nui-file-input__preview-item">
          {#if item.info.url}
            <img
              src={item.info.url}
              alt={item.info.name}
              class="nui-file-input__preview-thumb"
            />
          {:else}
            <span class="nui-file-input__preview-icon" aria-hidden="true">
              {getFileIcon(item.file.type)}
            </span>
          {/if}
          <div class="nui-file-input__preview-details">
            <span class="nui-file-input__preview-name" title={item.info.name}>
              {item.info.name}
            </span>
            <span class="nui-file-input__preview-size">
              {formatSize(item.info.size)}
            </span>
          </div>
          <button
            type="button"
            class="nui-file-input__remove"
            aria-label="Remove file {item.info.name}"
            title="Remove file {item.info.name}"
            {disabled}
            onclick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              removeFile(i);
            }}
          >
            ×
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .nui-file-input {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    width: 100%;
    font-family: inherit;
    box-sizing: border-box;
  }

  .nui-file-input__label {
    display: block;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--nui-fg, #fafafa);
    opacity: 0.85;
    cursor: pointer;
  }

  .nui-file-input__description {
    font-size: 0.75rem;
    color: var(--nui-fg-secondary, #a1a1aa);
    line-height: 1.25;
  }

  .nui-file-input__dropzone {
    position: relative;
    display: block;
    border: 1px dashed var(--nui-border, #3f3f46);
    border-radius: var(--nui-radius, 0.375rem);
    background: var(--nui-surface-alt, #101012);
    cursor: pointer;
    box-sizing: border-box;
    transition:
      border-color 0.15s ease,
      background-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  .nui-file-input__dropzone:hover:not(.is-disabled) {
    border-color: var(--nui-primary, #3b82f6);
    background: var(--nui-surface, #18181b);
  }

  .nui-file-input__dropzone.is-dragover {
    border-color: var(--nui-primary, #3b82f6);
    background: var(--nui-surface, #18181b);
    border-style: solid;
    box-shadow: 0 0 0 2px rgb(59 130 246 / 0.25);
  }

  .nui-file-input__dropzone.is-invalid {
    border-color: var(--nui-danger, #ef4444);
    border-style: solid;
  }

  .nui-file-input__dropzone:focus-within {
    border-color: var(--nui-primary, #3b82f6);
    outline: 2px solid var(--nui-primary, #3b82f6);
    outline-offset: 2px;
  }

  .nui-file-input__dropzone.is-invalid:focus-within {
    border-color: var(--nui-danger, #ef4444);
    outline-color: var(--nui-danger, #ef4444);
  }

  .nui-file-input__dropzone.is-disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  /* Visually hidden native input allowing focus and keyboard interaction */
  .nui-file-input__native {
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

  .nui-file-input__control {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    box-sizing: border-box;
  }

  .nui-file-input__icon {
    font-size: 1.25rem;
    opacity: 0.85;
    user-select: none;
    flex-shrink: 0;
  }

  .nui-file-input__content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
  }

  .nui-file-input__text {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--nui-fg, #fafafa);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .nui-file-input__hint {
    font-size: 0.75rem;
    color: var(--nui-fg-secondary, #a1a1aa);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .nui-file-input__action-btn {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.35rem 0.65rem;
    border-radius: var(--nui-radius, 0.25rem);
    background: var(--nui-surface, #18181b);
    border: 1px solid var(--nui-border, #3f3f46);
    color: var(--nui-fg, #fafafa);
    flex-shrink: 0;
    user-select: none;
    transition:
      background-color 0.15s ease,
      border-color 0.15s ease;
  }

  .nui-file-input__dropzone:hover:not(.is-disabled)
    .nui-file-input__action-btn {
    border-color: var(--nui-primary, #3b82f6);
    background: var(--nui-primary, #3b82f6);
    color: #fff;
  }

  .nui-file-input__error {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.75rem;
    color: var(--nui-danger, #ef4444);
    font-weight: 500;
    margin-top: 0.1rem;
  }

  .nui-file-input__error-icon {
    font-size: 0.875rem;
    flex-shrink: 0;
  }

  .nui-file-input__preview {
    list-style: none;
    margin: 0;
    padding: 0.25rem 0 0 0;
    gap: 0.375rem;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }

  .nui-file-input__preview-item {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.45rem 0.65rem;
    background: var(--nui-surface-alt, #18181b);
    border: 1px solid var(--nui-border, #27272a);
    border-radius: var(--nui-radius, 0.25rem);
    font-size: 0.8125rem;
    box-sizing: border-box;
    transition: border-color 0.15s ease;
  }

  .nui-file-input__preview-item:hover {
    border-color: var(--nui-border-hover, #3f3f46);
  }

  .nui-file-input__preview-thumb {
    width: 2rem;
    height: 2rem;
    border-radius: var(--nui-radius, 0.25rem);
    object-fit: cover;
    flex-shrink: 0;
    border: 1px solid var(--nui-border, #27272a);
  }

  .nui-file-input__preview-icon {
    font-size: 1.15rem;
    flex-shrink: 0;
    user-select: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
  }

  .nui-file-input__preview-details {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .nui-file-input__preview-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--nui-fg, #fafafa);
    font-weight: 500;
  }

  .nui-file-input__preview-size {
    font-size: 0.72rem;
    color: var(--nui-fg-secondary, #a1a1aa);
  }

  .nui-file-input__remove {
    border: 1px solid transparent;
    border-radius: var(--nui-radius, 0.25rem);
    background: transparent;
    color: var(--nui-danger, #ef4444);
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0.15rem 0.35rem;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition:
      background-color 0.15s ease,
      border-color 0.15s ease;
  }

  .nui-file-input__remove:hover:not(:disabled) {
    background: rgb(239 68 68 / 0.15);
    border-color: rgb(239 68 68 / 0.3);
  }

  .nui-file-input__remove:focus-visible {
    outline: 2px solid var(--nui-danger, #ef4444);
    outline-offset: 1px;
  }

  .nui-file-input__remove:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  @media (prefers-reduced-motion: reduce) {
    .nui-file-input__dropzone,
    .nui-file-input__action-btn,
    .nui-file-input__preview-item,
    .nui-file-input__remove {
      transition: none;
    }
  }
</style>
