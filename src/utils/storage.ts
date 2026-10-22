/**
 * Persistent Storage Adapter
 * Primary: localStorage with LZ-String compression
 * Fallback: IndexedDB (via idb-keyval) when QuotaExceededError is thrown
 */

import LZString from 'lz-string';
import { get, set, del, clear } from 'idb-keyval';

export const SCHEMA_VERSION = 1;
export const STATS_VERSION = 1;
export const STORAGE_PREFIX = `lb_pro:v${SCHEMA_VERSION}`;

export interface StorageMetadata {
  isCompressed: boolean;
  storedInIdb: boolean;
  byteLength: number;
  updatedAt: number;
}

class StorageAdapter {
  private prefix: string;
  private idbFallbackActive = false;
  private hasIdb = typeof indexedDB !== 'undefined';

  constructor(prefix = STORAGE_PREFIX) {
    this.prefix = prefix;
  }

  private getKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  private getMetaKey(key: string): string {
    return `${this.prefix}:_meta:${key}`;
  }

  public isUsingIdb(): boolean {
    return this.idbFallbackActive;
  }

  /**
   * Stores value. Attempts compressed localStorage first; falls back to IndexedDB on QuotaExceeded.
   */
  public async setItem<T>(key: string, value: T, shouldCompress = true): Promise<void> {
    const rawJson = JSON.stringify(value);
    const dataToStore = shouldCompress ? LZString.compressToUTF16(rawJson) : rawJson;
    const fullKey = this.getKey(key);
    const metaKey = this.getMetaKey(key);

    const meta: StorageMetadata = {
      isCompressed: shouldCompress,
      storedInIdb: false,
      byteLength: dataToStore.length * 2,
      updatedAt: Date.now()
    };

    try {
      localStorage.setItem(fullKey, dataToStore);
      localStorage.setItem(metaKey, JSON.stringify(meta));
      if (this.hasIdb) {
        await del(fullKey);
      }
    } catch (err: unknown) {
      if (this.hasIdb && err instanceof DOMException && (err.name === 'QuotaExceededError' || err.code === 22)) {
        this.idbFallbackActive = true;
        meta.storedInIdb = true;
        await set(fullKey, dataToStore);
        try {
          localStorage.removeItem(fullKey);
          localStorage.setItem(metaKey, JSON.stringify(meta));
        } catch {
          await set(metaKey, JSON.stringify(meta));
        }
      } else {
        throw err;
      }
    }
  }

  /**
   * Retrieves and decompresses value.
   */
  public async getItem<T>(key: string): Promise<T | null> {
    const fullKey = this.getKey(key);
    const metaKey = this.getMetaKey(key);

    let meta: StorageMetadata | null = null;
    const metaRaw = localStorage.getItem(metaKey) || (this.hasIdb ? await get<string>(metaKey) : null);
    if (metaRaw) {
      try {
        meta = JSON.parse(metaRaw);
      } catch {
        meta = null;
      }
    }

    let rawData: string | null | undefined = null;
    if (meta?.storedInIdb && this.hasIdb) {
      rawData = await get<string>(fullKey);
    } else {
      rawData = localStorage.getItem(fullKey);
      if (!rawData && this.hasIdb) {
        rawData = await get<string>(fullKey);
      }
    }

    if (!rawData) return null;

    try {
      const isCompressed = meta ? meta.isCompressed : true;
      let jsonStr = rawData;
      if (isCompressed) {
        const decompressed = LZString.decompressFromUTF16(rawData);
        if (decompressed) {
          jsonStr = decompressed;
        }
      }
      return JSON.parse(jsonStr) as T;
    } catch {
      return null;
    }
  }

  public async removeItem(key: string): Promise<void> {
    const fullKey = this.getKey(key);
    const metaKey = this.getMetaKey(key);
    localStorage.removeItem(fullKey);
    localStorage.removeItem(metaKey);
    if (this.hasIdb) {
      await del(fullKey);
      await del(metaKey);
    }
  }

  public async clearAllData(): Promise<void> {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(this.prefix)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    if (this.hasIdb) {
      await clear();
    }
    this.idbFallbackActive = false;
  }

  public async getStorageUsage(): Promise<{ usedBytes: number; quotaFallback: boolean }> {
    let bytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(this.prefix)) {
        const val = localStorage.getItem(k) || '';
        bytes += (k.length + val.length) * 2;
      }
    }
    return {
      usedBytes: bytes,
      quotaFallback: this.idbFallbackActive
    };
  }
}

export const storage = new StorageAdapter();
