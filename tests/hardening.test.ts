/**
 * Hardening, Performance Benchmarking & Acceptance Gate Tests
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { extractLetterboxdZip } from '../src/services/parser/zipParser.ts';
import { processLetterboxdExport } from '../src/services/parser/csvParser.ts';
import { calculateAnalyticsSnapshot } from '../src/services/analytics/engine.ts';
import { buildDemoEnrichedMovie } from '../src/services/synthetic/demoLoader.ts';
import { Film } from '../src/types/domain.ts';

describe('Phase 6: Hardening & Performance Benchmarking', () => {
  const synth5000Path = path.resolve(process.cwd(), 'fixtures/synthetic-5000.zip');
  const realExportPath = path.resolve(process.cwd(), 'letterboxd-shafiemoji-2026-10-20-04-30-utc.zip');

  describe('5,000-Film Synthetic Performance Benchmark', () => {
    it('parses and computes full analytics snapshot on 5,000 films within SLA (< 1500ms)', () => {
      expect(fs.existsSync(synth5000Path)).toBe(true);
      const zipBuffer = fs.readFileSync(synth5000Path);
      const uint8 = new Uint8Array(zipBuffer.buffer, zipBuffer.byteOffset, zipBuffer.byteLength);

      // 1. Measure Decompression Time
      const t0 = performance.now();
      const extracted = extractLetterboxdZip(uint8);
      const tDecompress = performance.now() - t0;

      expect(extracted.size).toBeGreaterThan(0);
      expect(tDecompress).toBeLessThan(1500); // well within budget

      // 2. Measure CSV Processing Time
      const t1 = performance.now();
      const parsed = processLetterboxdExport(extracted);
      const tParse = performance.now() - t1;

      expect(Object.keys(parsed.films).length).toBe(5000);
      expect(tParse).toBeLessThan(1500);

      // 3. Enrich a subset with mock TMDb data to test full analytics engine computation
      const enrichedFilms: Record<string, Film> = {};
      let i = 0;
      for (const [uri, film] of Object.entries(parsed.films)) {
        enrichedFilms[uri] = {
          ...film,
          match: {
            status: 'confident',
            tmdbId: 1000 + i,
            score: 0.95
          },
          metadata: buildDemoEnrichedMovie(i, film.name, film.year || 2020)
        };
        i++;
      }

      // 4. Measure Analytics Snapshot Computation on 5,000 films
      const t2 = performance.now();
      const snapshot = calculateAnalyticsSnapshot(
        enrichedFilms,
        parsed.entries,
        parsed.lists,
        parsed.profile,
        { range: 'all' }
      );
      const tCompute = performance.now() - t2;

      expect(snapshot.s1Snapshot.totalFilms).toBe(5000);
      expect(snapshot.s4Ratings.histogram.length).toBe(10);
      expect(snapshot.s7People.directors.length).toBeGreaterThan(0);
      expect(tCompute).toBeLessThan(1000); // 5,000 films computed in < 1 second!
    });
  });

  describe('Acceptance Testing on Real Letterboxd Export', () => {
    it('successfully extracts and parses real user export with zero PII leakage', () => {
      if (!fs.existsSync(realExportPath)) {
        // Skip if local export is not present
        return;
      }

      const realBuffer = fs.readFileSync(realExportPath);
      const realUint8 = new Uint8Array(realBuffer.buffer, realBuffer.byteOffset, realBuffer.byteLength);
      const extracted = extractLetterboxdZip(realUint8);

      expect(extracted.has('diary.csv')).toBe(true);
      expect(extracted.has('watched.csv')).toBe(true);

      const parsed = processLetterboxdExport(extracted);

      // Verify aggregate metrics are valid numbers
      const totalFilms = Object.keys(parsed.films).length;
      const totalEntries = parsed.entries.length;

      expect(totalFilms).toBeGreaterThan(0);
      expect(totalEntries).toBeGreaterThan(0);

      // Verify strict privacy guarantee: no PII leaked into profile domain model
      if (parsed.profile) {
        const rawProfile = parsed.profile as unknown as Record<string, unknown>;
        expect(rawProfile['emailAddress']).toBeUndefined();
        expect(rawProfile['email']).toBeUndefined();
        expect(rawProfile['familyName']).toBeUndefined();
        expect(rawProfile['location']).toBeUndefined();
        expect(rawProfile['website']).toBeUndefined();
        expect(rawProfile['pronoun']).toBeUndefined();
      }

      // Verify snapshot can be computed cleanly without throwing
      const snapshot = calculateAnalyticsSnapshot(
        parsed.films,
        parsed.entries,
        parsed.lists,
        parsed.profile,
        { range: 'all' }
      );

      // Universe includes watched, diary, ratings, reviews and liked (1,742 films)
      // totalFilms in parsed.films also contains watchlist-only films (1,911 total)
      expect(snapshot.s1Snapshot.totalFilms).toBe(1742);
      expect(snapshot.s1Snapshot.totalViewings).toBe(totalEntries);
      expect(totalFilms).toBe(1911);
    });
  });
});
