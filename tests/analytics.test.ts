import { describe, it, expect } from 'vitest';
import {
  mean,
  median,
  mode,
  standardDeviation,
  pearsonCorrelation,
  bayesianShrinkage,
  normalizedShannonEntropy,
  roundToOneDecimal
} from '../src/services/analytics/statistical.ts';
import { calculateAnalyticsSnapshot } from '../src/services/analytics/engine.ts';
import { Film, Entry } from '../src/types/domain.ts';
import { createMockMovie } from './mocks/mockTmdb.ts';

describe('Phase 3: Analytics Engine & Golden-Value Tests', () => {
  describe('Statistical Primitives (Golden Values)', () => {
    it('computes arithmetic mean accurately', () => {
      expect(mean([1, 2, 3, 4, 5])).toBe(3);
      expect(mean([2, 4, 6, 8])).toBe(5);
      expect(mean([])).toBe(0);
    });

    it('computes median for odd and even length arrays', () => {
      expect(median([1, 3, 5])).toBe(3);
      expect(median([1, 2, 3, 4])).toBe(2.5);
      expect(median([10])).toBe(10);
      expect(median([])).toBe(0);
    });

    it('identifies statistical mode', () => {
      expect(mode([1, 2, 2, 3, 4])).toBe(2);
      expect(mode([4, 4, 4, 1, 2])).toBe(4);
    });

    it('calculates population standard deviation', () => {
      // Golden value: [2, 4, 4, 4, 5, 5, 7, 9] -> mean=5, variance=4, sd=2
      expect(standardDeviation([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2);
      expect(standardDeviation([5, 5, 5])).toBe(0);
      expect(standardDeviation([10])).toBe(0);
    });

    it('calculates Pearson correlation coefficient r', () => {
      // Perfect positive correlation with n >= 20
      const x = Array.from({ length: 25 }, (_, i) => i);
      const y = Array.from({ length: 25 }, (_, i) => i * 2 + 5);
      const r = pearsonCorrelation(x, y, 20);
      expect(r).not.toBeNull();
      expect(Math.abs(r! - 1.0)).toBeLessThan(0.0001);

      // Returns null when sample size is below threshold (n < 20)
      expect(pearsonCorrelation([1, 2, 3], [2, 4, 6], 20)).toBeNull();
    });

    it('applies Bayesian Shrinkage formula accurately', () => {
      // Formula: (n * groupMean + k * overallMean) / (n + k)
      // groupMean=4.5, n=5, overallMean=3.0, k=5 -> (5*4.5 + 5*3.0) / 10 = (22.5 + 15)/10 = 3.75
      const shrunken = bayesianShrinkage(4.5, 5, 3.0, 5);
      expect(shrunken).toBe(3.75);

      // Large sample pulls towards group mean: n=95, k=5
      const largeSample = bayesianShrinkage(4.5, 95, 3.0, 5);
      expect(largeSample).toBeCloseTo(4.425, 3);
    });

    it('calculates Normalized Shannon Entropy', () => {
      // Monoculture (all in 1 category) -> entropy = 0.0
      expect(normalizedShannonEntropy([100])).toBe(0);
      expect(normalizedShannonEntropy([100, 0, 0])).toBe(0);

      // Perfectly balanced distribution across 4 categories -> entropy = 1.0
      const balanced = normalizedShannonEntropy([25, 25, 25, 25]);
      expect(Math.abs(balanced - 1.0)).toBeLessThan(0.0001);
    });

    it('rounds numbers to single decimal place consistently', () => {
      expect(roundToOneDecimal(3.14159)).toBe(3.1);
      expect(roundToOneDecimal(4.68)).toBe(4.7);
      expect(roundToOneDecimal(4.0)).toBe(4.0);
    });
  });

  describe('Engine End-to-End Aggregation & Metrics', () => {
    function buildMockDataset(): { films: Record<string, Film>; entries: Entry[] } {
      const films: Record<string, Film> = {};
      const entries: Entry[] = [];

      // Create 10 films with known metadata and viewings
      for (let i = 1; i <= 10; i++) {
        const uri = `https://boxd.it/film_${i}`;
        const rating = i % 2 === 0 ? 4.0 : 3.0;
        const mockMovie = createMockMovie(i, `Film ${i}`, 2010 + i);

        films[uri] = {
          letterboxdUri: uri,
          name: `Film ${i}`,
          year: 2010 + i,
          watched: true,
          rating,
          liked: i <= 3,
          onWatchlist: i >= 8,
          match: { status: 'confident', tmdbId: i },
          metadata: mockMovie
        };

        // Diary entries
        const dateStr = `2024-03-${String(i).padStart(2, '0')}`;
        entries.push({
          entryId: `entry_${i}`,
          filmKey: uri,
          watchedDate: dateStr,
          isApproximate: false,
          loggedDate: dateStr,
          rating,
          rewatch: i === 1, // Film 1 rewatched
          tags: ['cinema', 'festival'],
          review: i === 1 ? 'An astonishing masterpiece with unforgettable visuals.' : undefined
        });

        if (i === 1) {
          // Extra viewing for rewatch
          entries.push({
            entryId: `entry_1_rewatch`,
            filmKey: uri,
            watchedDate: '2024-03-25',
            isApproximate: false,
            loggedDate: '2024-03-25',
            rating: 5.0,
            rewatch: true,
            tags: ['favorites']
          });
        }
      }

      return { films, entries };
    }

    it('computes S1 snapshot headline tiles accurately', () => {
      const { films, entries } = buildMockDataset();
      const snapshot = calculateAnalyticsSnapshot(films, entries, []);

      expect(snapshot.s1Snapshot.totalFilms).toBe(10);
      expect(snapshot.s1Snapshot.totalViewings).toBe(11); // 10 + 1 rewatch
      expect(snapshot.s1Snapshot.averageRating).toBe(3.5); // alternating 3 and 4
      expect(snapshot.s1Snapshot.reviewsCount).toBe(1);
      expect(snapshot.s1Snapshot.rewatchesCount).toBe(2);
      expect(snapshot.s1Snapshot.likedFilmsCount).toBe(3);
      expect(snapshot.s1Snapshot.uniqueCountriesCount).toBeGreaterThan(0);
      expect(snapshot.s1Snapshot.uniqueDirectorsCount).toBeGreaterThan(0);
    });

    it('computes S3 volume, rhythm and 365-day calendar', () => {
      const { films, entries } = buildMockDataset();
      const snapshot = calculateAnalyticsSnapshot(films, entries, []);

      expect(snapshot.s3Volume.yearlyVolume.length).toBeGreaterThan(0);
      expect(snapshot.s3Volume.trailing365Calendar.length).toBe(365);
      expect(snapshot.s3Volume.streaks.longestStreakDays).toBeGreaterThan(0);
    });

    it('computes S4 ratings histogram, mean, median, mode and dispersion', () => {
      const { films, entries } = buildMockDataset();
      const snapshot = calculateAnalyticsSnapshot(films, entries, []);

      expect(snapshot.s4Ratings.histogram.length).toBe(10);
      expect(snapshot.s4Ratings.mean).toBe(3.5);
      expect(snapshot.s4Ratings.median).toBe(3.5);
      expect(snapshot.s4Ratings.rewatchRatingDelta.totalRewatched).toBe(1);
      expect(snapshot.s4Ratings.rewatchRatingDelta.averageDelta).toBe(2.0); // 5.0 - 3.0
    });

    it('computes S6 taste affinities with Bayesian shrinkage', () => {
      const { films, entries } = buildMockDataset();
      const snapshot = calculateAnalyticsSnapshot(films, entries, []);

      expect(snapshot.s6Taste.genreAffinity.length).toBeGreaterThan(0);
      snapshot.s6Taste.genreAffinity.forEach((g) => {
        expect(g.shrunkMean).toBeGreaterThan(0);
        expect(g.n).toBeGreaterThan(0);
      });
    });

    it('computes S7 people rankings by director and cast', () => {
      const { films, entries } = buildMockDataset();
      const snapshot = calculateAnalyticsSnapshot(films, entries, []);

      expect(snapshot.s7People.directors.length).toBeGreaterThan(0);
      expect(snapshot.s7People.actors.length).toBeGreaterThan(0);
    });

    it('handles edge cases: completely empty dataset gracefully', () => {
      const snapshot = calculateAnalyticsSnapshot({}, [], []);
      expect(snapshot.s1Snapshot.totalFilms).toBe(0);
      expect(snapshot.s1Snapshot.totalViewings).toBe(0);
      expect(snapshot.s1Snapshot.averageRating).toBe(0);
      expect(snapshot.s3Volume.trailing365Calendar.length).toBe(365);
      expect(snapshot.s4Ratings.histogram.length).toBe(10);
    });
  });
});
