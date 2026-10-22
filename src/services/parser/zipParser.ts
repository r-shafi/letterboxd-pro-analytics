/**
 * fflate ZIP extraction with Zip-Bomb limits and path traversal defense
 */

import { unzipSync, strFromU8 } from 'fflate';

export interface UnzipLimits {
  maxArchiveBytes: number; // default 100 MB
  maxTotalUncompressedBytes: number; // default 250 MB
  maxEntryBytes: number; // default 50 MB
  maxEntries: number; // default 500 files
}

export const DEFAULT_UNZIP_LIMITS: UnzipLimits = {
  maxArchiveBytes: 100 * 1024 * 1024,
  maxTotalUncompressedBytes: 250 * 1024 * 1024,
  maxEntryBytes: 50 * 1024 * 1024,
  maxEntries: 500
};

export class ZipSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZipSecurityError';
  }
}

/**
 * Extracts a ZIP archive buffer into a Map<relativePath, stringContent>
 * strictly enforcing all zip-bomb, nested archive, and traversal limits.
 */
export function extractLetterboxdZip(
  buffer: Uint8Array,
  limits: UnzipLimits = DEFAULT_UNZIP_LIMITS
): Map<string, string> {
  if (buffer.byteLength > limits.maxArchiveBytes) {
    throw new ZipSecurityError(
      `Archive size (${(buffer.byteLength / (1024 * 1024)).toFixed(1)} MB) exceeds security limit of ${limits.maxArchiveBytes / (1024 * 1024)} MB.`
    );
  }

  const extractedFiles = new Map<string, string>();
  let totalBytes = 0;

  // Decompress with fflate
  const unzipped = unzipSync(buffer);
  const keys = Object.keys(unzipped);
  if (keys.length > limits.maxEntries) {
    throw new ZipSecurityError(`Archive contains more than ${limits.maxEntries} entries.`);
  }

  for (const [relativePath, data] of Object.entries(unzipped)) {
    // Path traversal check
    const normalizedPath = relativePath.replace(/\\/g, '/');
    if (
      normalizedPath.includes('../') ||
      normalizedPath.includes('/..') ||
      normalizedPath.startsWith('/')
    ) {
      throw new ZipSecurityError(`Potential path traversal attempt detected in entry: ${relativePath}`);
    }

    // Nested archive rejection
    if (normalizedPath.endsWith('.zip') || normalizedPath.endsWith('.tar') || normalizedPath.endsWith('.gz')) {
      throw new ZipSecurityError(`Nested archive rejected for security: ${relativePath}`);
    }

    // Ignore directory entries (ending with /)
    if (normalizedPath.endsWith('/')) {
      continue;
    }

    // Check entry size
    const byteLength = data.byteLength;
    if (byteLength > limits.maxEntryBytes) {
      throw new ZipSecurityError(`Entry ${relativePath} exceeds maximum size limit of ${limits.maxEntryBytes / (1024 * 1024)} MB.`);
    }

    totalBytes += byteLength;
    if (totalBytes > limits.maxTotalUncompressedBytes) {
      throw new ZipSecurityError(`Total uncompressed size exceeds security limit of ${limits.maxTotalUncompressedBytes / (1024 * 1024)} MB.`);
    }

    // Decode to UTF-8 string
    const textContent = strFromU8(data);
    extractedFiles.set(normalizedPath, textContent);
  }

  return extractedFiles;
}
