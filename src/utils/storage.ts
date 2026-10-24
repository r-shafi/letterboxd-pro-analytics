/**
 * Persistent Storage Adapter
 * Supports chunked/sharded film persistence with dirty tracking,
 * idle background flushing, pagehide/visibilitychange guarantees,
 * and seamless fallback from compressed localStorage to IndexedDB.
 */

import LZString from 'lz-string';
import { get, set, del, clear } from 'idb-keyval';
import { Film } from '../types/domain.ts';

export const SCHEMA_VERSION = 2;
export const STATS_VERSION = 1;
export const STORAGE_PREFIX = `lb_pro:v${SCHEMA_VERSION}`;
export const LEGACY_STORAGE_PREFIX = `lb_pro:v1`;

export const CHUNK_SIZE = 50;

export interface StorageMetadata {
  isCompressed: boolean;
  storedInIdb: boolean;
  byteLength: number;
  updatedAt: number;
}

export interface FilmChunkManifest {
  chunkCount: number;
  chunkSize: number;
  totalFilms: number;
  chunkKeys: string[];
  updatedAt: number;
}

class StorageAdapter {
  private prefix: string;
  private idbFallbackActive = false;
  private hasIdb = typeof indexedDB !== 'undefined';

  // Incremental dirty tracking for films
  private filmManifest: FilmChunkManifest | null = null;
  private filmToChunkIndex = new Map<string, number>();
  private dirtyChunkIndices = new Set<number>();
  private cachedChunks = new Map<number, Record<string, Film>>();
  private allFilmsMemoryCache: Record<string, Film> | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private isFlushing = false;

  constructor(prefix = STORAGE_PREFIX) {
    this.prefix = prefix;
    this.setupLifecycleFlush();
  }

  private setupLifecycleFlush(): void {
    if (typeof window !== 'undefined') {
      const handleFlush = () => {
        this.flushDirtyFilmsSync();
      };
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          handleFlush();
        }
      });
      window.addEventListener('pagehide', handleFlush);
      window.addEventListener('beforeunload', handleFlush);
    }
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
    // If setting data:films directly, route through sharded persistence
    if (key === 'data:films' && typeof value === 'object' && value !== null) {
      await this.saveFilmsIncremental(value as Record<string, Film>);
      return;
    }

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
      if (
        this.hasIdb &&
        err instanceof DOMException &&
        (err.name === 'QuotaExceededError' || err.code === 22)
      ) {
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
   * Retrieves and decompresses value with migration fallback to v1.
   */
  public async getItem<T>(key: string): Promise<T | null> {
    // Route data:films through incremental sharded loader
    if (key === 'data:films') {
      const films = await this.loadFilmsIncremental();
      if (films) return films as T;
    }

    const fullKey = this.getKey(key);
    const metaKey = this.getMetaKey(key);

    let rawData = await this.readRawData(fullKey, metaKey);

    // Fallback to legacy prefix if not found under current prefix
    if (!rawData && this.prefix !== LEGACY_STORAGE_PREFIX) {
      const legacyFullKey = `${LEGACY_STORAGE_PREFIX}:${key}`;
      const legacyMetaKey = `${LEGACY_STORAGE_PREFIX}:_meta:${key}`;
      rawData = await this.readRawData(legacyFullKey, legacyMetaKey);
    }

    if (!rawData) return null;

    try {
      return JSON.parse(rawData) as T;
    } catch {
      return null;
    }
  }

  private async readRawData(
    fullKey: string,
    metaKey: string
  ): Promise<string | null> {
    let meta: StorageMetadata | null = null;
    const metaRaw =
      localStorage.getItem(metaKey) || (this.hasIdb ? await get<string>(metaKey) : null);
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

    const isCompressed = meta ? meta.isCompressed : true;
    if (isCompressed) {
      const decompressed = LZString.decompressFromUTF16(rawData);
      if (decompressed) {
        return decompressed;
      }
    }
    return rawData;
  }

  /**
   * Saves films partitioned into small chunks (50 films each) with a manifest.
   */
  public async saveFilmsIncremental(films: Record<string, Film>): Promise<void> {
    this.allFilmsMemoryCache = { ...films };
    const uris = Object.keys(films);
    const chunkCount = Math.ceil(uris.length / CHUNK_SIZE);
    const chunkKeys: string[] = [];

    this.filmToChunkIndex.clear();
    this.cachedChunks.clear();
    this.dirtyChunkIndices.clear();

    for (let c = 0; c < chunkCount; c++) {
      const chunkUris = uris.slice(c * CHUNK_SIZE, (c + 1) * CHUNK_SIZE);
      const chunkObj: Record<string, Film> = {};
      chunkUris.forEach((u) => {
        chunkObj[u] = films[u];
        this.filmToChunkIndex.set(u, c);
      });

      this.cachedChunks.set(c, chunkObj);
      const chunkKey = `data:films:chunk:${c}`;
      chunkKeys.push(chunkKey);
      // Persist individual chunk (lightweight ~15-20KB compressed)
      await this.setItem(chunkKey, chunkObj, true);
    }

    const manifest: FilmChunkManifest = {
      chunkCount,
      chunkSize: CHUNK_SIZE,
      totalFilms: uris.length,
      chunkKeys,
      updatedAt: Date.now()
    };

    this.filmManifest = manifest;
    await this.setItem('data:films:manifest', manifest, false);
  }

  /**
   * Loads films from chunks or migrates legacy unchunked storage.
   */
  public async loadFilmsIncremental(): Promise<Record<string, Film> | null> {
    if (this.allFilmsMemoryCache && Object.keys(this.allFilmsMemoryCache).length > 0) {
      return this.allFilmsMemoryCache;
    }

    // Try reading manifest
    let manifest = await this.getItem<FilmChunkManifest>('data:films:manifest');
    if (!manifest) {
      // Check legacy prefix manifest
      const legacyManifestRaw = localStorage.getItem(`${LEGACY_STORAGE_PREFIX}:data:films:manifest`);
      if (legacyManifestRaw) {
        try {
          manifest = JSON.parse(legacyManifestRaw);
        } catch {}
      }
    }

    if (manifest && manifest.chunkKeys && manifest.chunkKeys.length > 0) {
      const combined: Record<string, Film> = {};
      this.filmManifest = manifest;
      this.filmToChunkIndex.clear();
      this.cachedChunks.clear();

      for (let c = 0; c < manifest.chunkKeys.length; c++) {
        const key = manifest.chunkKeys[c];
        const chunk = await this.getItem<Record<string, Film>>(key);
        if (chunk) {
          this.cachedChunks.set(c, chunk);
          Object.entries(chunk).forEach(([uri, film]) => {
            combined[uri] = film;
            this.filmToChunkIndex.set(uri, c);
          });
        }
      }

      this.allFilmsMemoryCache = combined;
      return combined;
    }

    // Check monolithic legacy data:films
    const legacyRawKey = `${LEGACY_STORAGE_PREFIX}:data:films`;
    const legacyMetaKey = `${LEGACY_STORAGE_PREFIX}:_meta:data:films`;
    const rawLegacy = await this.readRawData(legacyRawKey, legacyMetaKey);

    if (rawLegacy) {
      try {
        const parsed = JSON.parse(rawLegacy) as Record<string, Film>;
        if (parsed && Object.keys(parsed).length > 0) {
          // Asynchronously migrate to chunked format in background
          this.saveFilmsIncremental(parsed).catch(() => {});
          return parsed;
        }
      } catch {}
    }

    return null;
  }

  /**
   * Incremental single-film update: marks only the specific chunk dirty.
   * Takes < 1 ms on the main thread!
   */
  public queueDirtyFilm(film: Film): void {
    if (!this.allFilmsMemoryCache) {
      this.allFilmsMemoryCache = {};
    }
    this.allFilmsMemoryCache[film.letterboxdUri] = film;

    let chunkIdx = this.filmToChunkIndex.get(film.letterboxdUri);
    if (chunkIdx === undefined) {
      // New film not in existing chunk, append to last or create new
      const lastChunkIdx = (this.filmManifest?.chunkCount || 1) - 1;
      const lastChunk = this.cachedChunks.get(lastChunkIdx) || {};
      if (Object.keys(lastChunk).length < CHUNK_SIZE) {
        chunkIdx = lastChunkIdx;
      } else {
        chunkIdx = lastChunkIdx + 1;
      }
      this.filmToChunkIndex.set(film.letterboxdUri, chunkIdx);
    }

    let chunk = this.cachedChunks.get(chunkIdx);
    if (!chunk) {
      chunk = {};
      this.cachedChunks.set(chunkIdx, chunk);
    }
    chunk[film.letterboxdUri] = film;
    this.dirtyChunkIndices.add(chunkIdx);

    // Schedule background flush on idle
    this.scheduleIdleFlush();
  }

  private scheduleIdleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => {
          this.flushDirtyFilms().catch(() => {});
        });
      } else {
        this.flushDirtyFilms().catch(() => {});
      }
    }, 400);
  }

  /**
   * Flushes only the dirty chunks to storage.
   */
  public async flushDirtyFilms(): Promise<void> {
    if (this.isFlushing || this.dirtyChunkIndices.size === 0) return;
    this.isFlushing = true;

    try {
      const toFlush = Array.from(this.dirtyChunkIndices);
      this.dirtyChunkIndices.clear();

      for (const idx of toFlush) {
        const chunk = this.cachedChunks.get(idx);
        if (chunk) {
          await this.setItem(`data:films:chunk:${idx}`, chunk, true);
        }
      }
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Synchronous fallback flush used on pagehide/visibilitychange.
   */
  public flushDirtyFilmsSync(): void {
    if (this.dirtyChunkIndices.size === 0) return;
    const toFlush = Array.from(this.dirtyChunkIndices);
    this.dirtyChunkIndices.clear();

    toFlush.forEach((idx) => {
      const chunk = this.cachedChunks.get(idx);
      if (chunk) {
        try {
          const raw = JSON.stringify(chunk);
          const fullKey = this.getKey(`data:films:chunk:${idx}`);
          // Write without heavy compression on emergency unload for instantaneous flush
          localStorage.setItem(fullKey, raw);
        } catch {}
      }
    });
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
    this.filmManifest = null;
    this.filmToChunkIndex.clear();
    this.cachedChunks.clear();
    this.dirtyChunkIndices.clear();
    this.allFilmsMemoryCache = null;

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (
        k &&
        (k.startsWith(this.prefix) || k.startsWith(LEGACY_STORAGE_PREFIX))
      ) {
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
      if (
        k &&
        (k.startsWith(this.prefix) || k.startsWith(LEGACY_STORAGE_PREFIX))
      ) {
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
