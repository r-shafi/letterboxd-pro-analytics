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
import { generateSyntheticZip } from '../src/services/synthetic/generator.ts';
import { Film } from '../src/types/domain.ts';

describe('Phase 6: Hardening & Performance Benchmarking', () => {
  const synth5000Path = path.resolve(process.cwd(), 'fixtures/synthetic-5000.zip');

  describe('5,000-Film Synthetic Performance Benchmark', () => {
    it('parses and computes full analytics snapshot on 5,000 films within SLA (< 1500ms)', () => {
      const uint8 = fs.existsSync(synth5000Path)
        ? new Uint8Array(fs.readFileSync(synth5000Path))
        : generateSyntheticZip({ filmCount: 5000 });

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

  describe('Acceptance Testing & PII Leakage Defense on Synthetic Export', () => {
    it('successfully extracts and parses synthetic export with zero PII leakage', () => {
      const synthZip = generateSyntheticZip({ filmCount: 250 });
      const extracted = extractLetterboxdZip(synthZip);

      expect(extracted.has('diary.csv')).toBe(true);
      expect(extracted.has('watched.csv')).toBe(true);

      const parsed = processLetterboxdExport(extracted);

      // Verify aggregate metrics are valid numbers
      const totalFilms = Object.keys(parsed.films).length;
      const totalEntries = parsed.entries.length;

      expect(totalFilms).toBe(250);
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

      expect(snapshot.s1Snapshot.totalFilms).toBe(parsed.report.filmsWatched);
      expect(snapshot.s1Snapshot.totalViewings).toBeGreaterThanOrEqual(totalEntries);
      expect(snapshot.s1Snapshot.averageRating).toBeGreaterThan(0);
    });
  });
});
