import { describe, it, expect, beforeEach } from 'vitest';
import { generateSyntheticZip, generateSyntheticExportFiles } from '../src/services/synthetic/generator.ts';
import { extractLetterboxdZip, ZipSecurityError } from '../src/services/parser/zipParser.ts';
import { processLetterboxdExport, parseListCsv } from '../src/services/parser/csvParser.ts';
import { MockTmdbService } from './mocks/mockTmdb.ts';
import { AdaptiveRateLimiter } from '../src/services/tmdb/limiter.ts';
import { storage } from '../src/utils/storage.ts';

describe('Phase 2: Ingestion & Pipeline Gate Tests', () => {
  beforeEach(async () => {
    await storage.clearAllData();
  });

  describe('ZIP Decompression & Zip-Bomb Security', () => {
    it('decompresses a synthetic zip archive cleanly', () => {
      const zipBuffer = generateSyntheticZip({ filmCount: 20 });
      const extracted = extractLetterboxdZip(zipBuffer);

      expect(extracted.has('profile.csv')).toBe(true);
      expect(extracted.has('watched.csv')).toBe(true);
      expect(extracted.has('ratings.csv')).toBe(true);
      expect(extracted.has('diary.csv')).toBe(true);
      expect(extracted.has('lists/best-of-cinema.csv')).toBe(true);
    });

    it('rejects archives exceeding byte limit', () => {
      const zipBuffer = generateSyntheticZip({ filmCount: 5 });
      expect(() => {
        extractLetterboxdZip(zipBuffer, {
          maxArchiveBytes: 50, // Tiny limit to trigger security guard
          maxTotalUncompressedBytes: 100000,
          maxEntryBytes: 10000,
          maxEntries: 100
        });
      }).toThrow(ZipSecurityError);
    });
  });

  describe('CSV Parsing, Normalization & Privacy Stripping', () => {
    it('sanitizes and strips private profile fields (email, family name, etc.)', () => {
      const files = generateSyntheticExportFiles({ filmCount: 20 });
      const filesMap = new Map<string, string>();
      for (const [name, u8] of Object.entries(files)) {
        filesMap.set(name, new TextDecoder().decode(u8));
      }

      const state = processLetterboxdExport(filesMap);
      expect(state.profile).toBeDefined();
      expect(state.profile?.username).toBe('synthetic_cinephile');
      expect(state.profile?.favoriteFilmUris.length).toBeGreaterThan(0);

      // Verify sensitive data does not exist on profile object
      const profileRecord = state.profile as unknown as Record<string, unknown>;
      expect(profileRecord['emailAddress']).toBeUndefined();
      expect(profileRecord['email']).toBeUndefined();
      expect(profileRecord['familyName']).toBeUndefined();
      expect(profileRecord['location']).toBeUndefined();
    });

    it('correctly parses Letterboxd v7 list format', () => {
      const listContent = `Letterboxd list export v7
Date,Name,Tags,URL,Description
2023-01-01,Test List,"tag1, tag2",https://boxd.it/list_test,"Multi-line
Description Here"

Position,Name,Year,URL,Description
1,Test Film A,2020,https://boxd.it/item1,First item
2,Test Film B,2021,https://boxd.it/item2,Second item
`;
      const parsed = parseListCsv(listContent, 'test-list');
      expect(parsed).not.toBeNull();
      expect(parsed?.name).toBe('Test List');
      expect(parsed?.items.length).toBe(2);
      expect(parsed?.items[0].name).toBe('Test Film A');
      expect(parsed?.items[1].position).toBe(2);
    });

    it('tracks date-unknown films accurately', () => {
      const files = generateSyntheticExportFiles({ filmCount: 20 });
      const filesMap = new Map<string, string>();
      for (const [name, u8] of Object.entries(files)) {
        filesMap.set(name, new TextDecoder().decode(u8));
      }

      const state = processLetterboxdExport(filesMap);
      expect(state.report.filmsDateUnknown).toBeGreaterThan(0);
      expect(state.report.totalUniqueFilms).toBe(20);
    });
  });

  describe('Canonical Film Mapping & URI Resolution', () => {
    it('resolves diary and review log-style URIs to canonical film URI and does not duplicate films', () => {
      const filesMap = new Map<string, string>();
      filesMap.set(
        'watched.csv',
        'Date,Name,Year,Letterboxd URI\n2023-01-01,Inception,2010,https://boxd.it/1sz2\n'
      );
      filesMap.set(
        'ratings.csv',
        'Date,Name,Year,Letterboxd URI,Rating\n2023-01-01,Inception,2010,https://boxd.it/1sz2,4.5\n'
      );
      // Diary carries log-style URI (e.g. entry URL https://boxd.it/log123)
      filesMap.set(
        'diary.csv',
        'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n2023-05-01,Inception,2010,https://boxd.it/log123,4.5,No,"cinema",2023-05-01\n'
      );
      filesMap.set(
        'reviews.csv',
        'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Tags,Watched Date\n2023-05-01,Inception,2010,https://boxd.it/rev123,4.5,No,"Great film",cinema,2023-05-01\n'
      );

      const state = processLetterboxdExport(filesMap);

      // Exactly 1 unique film
      expect(state.report.totalUniqueFilms).toBe(1);
      expect(Object.keys(state.films)).toEqual(['https://boxd.it/1sz2']);
      expect(state.films['https://boxd.it/1sz2'].name).toBe('Inception');

      // Exactly 1 diary entry linked to the canonical film URI, retaining raw log URI as entryId
      expect(state.entries.length).toBe(1);
      expect(state.entries[0].filmKey).toBe('https://boxd.it/1sz2');
      expect(state.entries[0].entryId).toBe('https://boxd.it/log123');
      expect(state.entries[0].review).toBe('Great film');
    });

    it('a film with two diary rows has two entries linked to the single canonical film', () => {
      const filesMap = new Map<string, string>();
      filesMap.set(
        'watched.csv',
        'Date,Name,Year,Letterboxd URI\n2022-01-01,Parasite,2019,https://boxd.it/hHum\n'
      );
      filesMap.set(
        'diary.csv',
        'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n' +
          '2022-01-01,Parasite,2019,https://boxd.it/diary_entry_1,5,No,"theatre",2022-01-01\n' +
          '2023-06-15,Parasite,2019,https://boxd.it/diary_entry_2,5,Yes,"bluray",2023-06-15\n'
      );

      const state = processLetterboxdExport(filesMap);

      // Total unique films is 1
      expect(state.report.totalUniqueFilms).toBe(1);
      expect(state.report.filmsWatched).toBe(1);

      // Two distinct entries linked to the canonical film URI
      expect(state.entries.length).toBe(2);
      expect(state.entries[0].filmKey).toBe('https://boxd.it/hHum');
      expect(state.entries[1].filmKey).toBe('https://boxd.it/hHum');
      expect(state.entries[0].entryId).toBe('https://boxd.it/diary_entry_1');
      expect(state.entries[1].entryId).toBe('https://boxd.it/diary_entry_2');
      expect(state.entries[0].rewatch).toBe(false);
      expect(state.entries[1].rewatch).toBe(true);
    });

    it('tracks same-title-same-year collisions without merging distinct films', () => {
      const filesMap = new Map<string, string>();
      filesMap.set(
        'watched.csv',
        'Date,Name,Year,Letterboxd URI\n' +
          '2021-01-01,Collision Movie,2020,https://boxd.it/film_A\n' +
          '2021-02-01,Collision Movie,2020,https://boxd.it/film_B\n'
      );

      const state = processLetterboxdExport(filesMap);

      // Both distinct films are preserved
      expect(state.report.totalUniqueFilms).toBe(2);
      expect(state.films['https://boxd.it/film_A']).toBeDefined();
      expect(state.films['https://boxd.it/film_B']).toBeDefined();

      // Collision logged in report
      expect(state.report.collisions).toBeDefined();
      expect(state.report.collisions!.length).toBe(1);
      expect(state.report.collisions![0].uris).toContain('https://boxd.it/film_A');
      expect(state.report.collisions![0].uris).toContain('https://boxd.it/film_B');
    });
  });

  describe('Adaptive Rate Limiter & Concurrency Behavior', () => {
    it('executes tasks under normal conditions and scales', async () => {
      const limiter = new AdaptiveRateLimiter(5, 10);
      const results: number[] = [];

      const tasks = Array.from({ length: 15 }, (_, i) => () =>
        limiter.schedule(async () => {
          results.push(i);
          return i;
        })
      );

      await Promise.all(tasks.map((t) => t()));
      expect(results.length).toBe(15);
      const stats = limiter.getStats();
      expect(stats.totalCompleted).toBe(15);
      expect(stats.totalFailed).toBe(0);
    });

    it('handles simulated 429 rate limit backoff and retries', async () => {
      const limiter = new AdaptiveRateLimiter(4, 10);
      let attempts = 0;

      const result = await limiter.schedule(async () => {
        attempts++;
        if (attempts <= 2) {
          throw new Error('TMDb Rate Limit Exceeded (HTTP 429)');
        }
        return 'success_after_retry';
      });

      expect(result).toBe('success_after_retry');
      expect(attempts).toBe(3);
    });
  });

  describe('1,000-Film Synthetic Import Gate', () => {
    it('successfully processes 1,000 synthetic films against Mock TMDb double', async () => {
      const files = generateSyntheticExportFiles({ filmCount: 1000 });
      const filesMap = new Map<string, string>();
      for (const [name, u8] of Object.entries(files)) {
        filesMap.set(name, new TextDecoder().decode(u8));
      }

      const state = processLetterboxdExport(filesMap);
      expect(state.report.totalUniqueFilms).toBe(1000);
      expect(state.entries.length).toBeGreaterThan(500);

      // Run matching with Mock TMDb
      const mockTmdb = new MockTmdbService();
      let matchedCount = 0;

      for (const film of Object.values(state.films)) {
        const matchRes = await mockTmdb.matchFilm(film.name, film.year);
        film.match = matchRes;
        if (matchRes.status === 'confident' && matchRes.tmdbId) {
          film.metadata = await mockTmdb.enrichMovie(matchRes.tmdbId);
          matchedCount++;
        }
      }

      expect(matchedCount).toBeGreaterThan(900);

      // Persist to storage
      await storage.setItem('data:films', state.films);
      await storage.setItem('data:entries', state.entries);

      // Hydrate from storage
      const hydratedFilms = await storage.getItem<Record<string, unknown>>('data:films');
      expect(hydratedFilms).not.toBeNull();
      expect(Object.keys(hydratedFilms!).length).toBe(1000);

      const usage = await storage.getStorageUsage();
      expect(usage.usedBytes).toBeGreaterThan(0);
    });
  });
});
