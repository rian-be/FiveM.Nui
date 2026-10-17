/**
 * UI representation of a selected file, including optional browser preview URL.
 */
export interface FileInfo {
  /** Unique stable identifier for the file entry. */
  id: string;
  /** File name including extension. */
  name: string;
  /** File size in bytes. */
  size: number;
  /** MIME type of the file. */
  type: string;
  /** Browser-only temporary ObjectURL for image preview (if preview enabled). */
  url?: string;
}

/**
 * Serialized metadata payload transmitted over FiveM NUI (omits ephemeral browser URLs).
 */
export interface FileMetadata {
  /** Unique stable identifier for the file entry. */
  id: string;
  /** File name including extension. */
  name: string;
  /** File size in bytes. */
  size: number;
  /** MIME type of the file. */
  type: string;
}
