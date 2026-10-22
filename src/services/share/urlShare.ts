/**
 * Serverless Shareable Stats via URL Fragment (#v1=...)
 * Deflate-raw compression via fflate + URL-safe Base64.
 * Includes Zod schema validation and prototype pollution defense.
 */

import * as fflate from 'fflate';
import { z } from 'zod';
import {
  AnalyticsSnapshot,
  TimeFilter,
  S1Snapshot,
  S2Identity,
  HeatmapDayCell
} from '../analytics/types.ts';
import { Film, Profile, TmdbMovieCompact } from '../../types/domain.ts';
import {
  parseCalendarDate,
  addDays,
  getWeekday,
  getTodayCalendarDate,
  isLeapYear
} from '../../utils/date.ts';

function createMockMovieMetadata(
  id: number,
  title: string,
  year?: number,
  runtime: number = 110
): TmdbMovieCompact {
  return {
    id,
    title,
    originalTitle: title,
    releaseDate: year ? `${year}-01-01` : '2000-01-01',
    releaseYear: year || 2000,
    runtime,
    genres: [],
    originalLanguage: 'en',
    spokenLanguages: [],
    productionCountries: [],
    productionCompanies: [],
    voteAverage: 7,
    voteCount: 100,
    popularity: 20,
    budget: 0,
    revenue: 0,
    keywords: [],
    directors: [],
    cast: [],
    writers: [],
    cinematographers: [],
    composers: [],
    editors: [],
    producers: [],
    fetchedAt: Date.now()
  };
}

// ---------------------------------------------------------------------------
// Base64URL Encoding / Decoding Utilities
// ---------------------------------------------------------------------------

export function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 =
    typeof btoa !== 'undefined'
      ? btoa(binary)
      : Buffer.from(binary, 'binary').toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToUint8Array(base64url: string): Uint8Array {
  // Validate characters
  if (!/^[A-Za-z0-9_-]+$/.test(base64url)) {
    throw new Error('Invalid Base64URL characters');
  }

  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }

  const binary =
    typeof atob !== 'undefined'
      ? atob(base64)
      : Buffer.from(base64, 'base64').toString('binary');
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// DTO Interfaces & Zod Schemas
// ---------------------------------------------------------------------------

// Sanitizer for plain text strings
const safeString = z.string().max(300).transform((s) => s.replace(/<[^>]*>?/gm, '').trim());

export const CompactSharedSchema = z.object({
  v: z.literal(1),
  type: z.literal('compact'),
  u: safeString,
  tf: z.number().int().nonnegative(),
  tv: z.number().int().nonnegative(),
  tr: z.number().int().nonnegative(),
  ar: z.number().min(0).max(5),
  rf: z.number().int().nonnegative(),
  lf: z.number().int().nonnegative(),
  rc: z.number().int().nonnegative(),
  rw: z.number().int().nonnegative(),
  rwr: z.number().min(0).max(100),
  uc: z.number().int().nonnegative(),
  ul: z.number().int().nonnegative(),
  ud: z.number().int().nonnegative(),
  ys: z.number().int().nonnegative(),
  du: z.number().int().nonnegative().default(0),
  tg: z.array(z.object({ n: safeString, c: z.number().int() })).max(10),
  td: z.array(z.object({ n: safeString, c: z.number().int(), r: z.number() })).max(10),
  ta: z.array(z.object({ n: safeString, c: z.number().int(), r: z.number() })).max(10),
  ff: z.array(z.object({ t: safeString, y: z.number().int().optional(), r: z.number().optional() })).max(10),
  ba: z.array(z.object({ id: safeString, n: safeString })).max(10),
  ad: z.record(z.string(), z.number().int()).optional(),
  flt: z.object({ y: z.number().int().optional() }).optional()
});

export type CompactSharedPayload = z.infer<typeof CompactSharedSchema>;

export const FullSharedSchema = z.object({
  v: z.literal(1),
  type: z.literal('full'),
  u: safeString,
  filter: z.object({
    range: z.enum(['all', 'year', 'custom']),
    selectedYear: z.number().int().optional(),
    startDate: safeString.optional(),
    endDate: safeString.optional()
  }),
  s1: z.object({
    totalFilms: z.number().int(),
    totalViewings: z.number().int(),
    totalRuntimeMinutes: z.number().int(),
    runtimeCoveragePercent: z.number(),
    averageRating: z.number(),
    ratingCoveragePercent: z.number(),
    ratedFilmsCount: z.number().int(),
    reviewsCount: z.number().int(),
    rewatchesCount: z.number().int(),
    likedFilmsCount: z.number().int(),
    uniqueCountriesCount: z.number().int(),
    uniqueLanguagesCount: z.number().int(),
    uniqueDirectorsCount: z.number().int(),
    yearsSpan: z.number().int(),
    earliestWatchDate: safeString.nullable(),
    latestWatchDate: safeString.nullable(),
    dateUnknownCount: z.number().int()
  }),
  s2: z.object({
    archetypes: z.array(
      z.object({
        id: safeString,
        name: safeString,
        description: safeString,
        thresholdLabel: safeString,
        valueLabel: safeString,
        achieved: z.boolean()
      })
    ),
    insights: z.array(
      z.object({
        id: safeString,
        headline: safeString,
        evidence: safeString,
        sampleSize: z.number(),
        category: z.enum(['volume', 'taste', 'habits', 'social'])
      })
    )
  }),
  s3: z.object({
    yearlyVolume: z.array(
      z.object({
        year: z.number().int(),
        filmsCount: z.number().int(),
        viewingsCount: z.number().int(),
        runtimeMinutes: z.number().int()
      })
    ),
    yearMonthMatrix: z.array(
      z.object({
        year: z.number().int(),
        months: z.array(z.number())
      })
    ),
    monthSeasonality: z.array(
      z.object({
        month: z.number().int(),
        count: z.number().int(),
        name: safeString
      })
    ),
    weekdayDistribution: z.array(
      z.object({
        weekday: z.number().int(),
        name: safeString,
        count: z.number().int(),
        sharePercent: z.number()
      })
    ),
    streaks: z.object({
      currentStreakDays: z.number().int(),
      isCurrentStreakActive: z.boolean(),
      longestStreakDays: z.number().int(),
      longestStreakStartDate: safeString.optional(),
      longestStreakEndDate: safeString.optional(),
      longestGapDays: z.number().int(),
      longestGapStartDate: safeString.optional(),
      longestGapEndDate: safeString.optional()
    }),
    marathonDays: z.array(
      z.object({
        date: safeString,
        count: z.number().int(),
        runtimeMinutes: z.number().int()
      })
    ),
    backlogLoggingLag: z.array(
      z.object({
        lagBucket: safeString,
        count: z.number().int()
      })
    ),
    activityDates: z.record(z.string(), z.number().int()).optional()
  }),
  s4: z.object({
    histogram: z.array(
      z.object({
        rating: z.number(),
        count: z.number().int(),
        percent: z.number()
      })
    ),
    mean: z.number(),
    median: z.number(),
    mode: z.number(),
    standardDeviation: z.number(),
    harshestYear: z
      .object({
        year: z.number().int(),
        avgRating: z.number(),
        shrunkRating: z.number(),
        count: z.number().int()
      })
      .nullable(),
    mostGenerousYear: z
      .object({
        year: z.number().int(),
        avgRating: z.number(),
        shrunkRating: z.number(),
        count: z.number().int()
      })
      .nullable(),
    likedVsRated: z.object({
      likedShareByRating: z.array(
        z.object({
          rating: z.number(),
          total: z.number().int(),
          likedCount: z.number().int(),
          percentLiked: z.number()
        })
      ),
      unlikedFiveStars: z.array(
        z.object({
          name: safeString,
          year: z.number().int().optional(),
          rating: z.number().optional()
        })
      ),
      likedLowRated: z.array(
        z.object({
          name: safeString,
          year: z.number().int().optional(),
          rating: z.number().optional()
        })
      )
    }),
    rewatchRatingDelta: z.object({
      averageDelta: z.number(),
      totalRewatched: z.number().int(),
      higherCount: z.number().int(),
      sameCount: z.number().int(),
      lowerCount: z.number().int()
    }),
    topRatedFilms: z.array(
      z.object({
        name: safeString,
        year: z.number().int().optional(),
        rating: z.number().optional()
      })
    ),
    lowestRatedFilms: z.array(
      z.object({
        name: safeString,
        year: z.number().int().optional(),
        rating: z.number().optional()
      })
    )
  }),
  s5: z.object({
    contrarianIndex: z.number(),
    generosityIndex: z.number(),
    correlationR: z.number().nullable(),
    meanDelta: z.number(),
    biggestOverrates: z.array(
      z.object({
        filmKey: safeString,
        title: safeString,
        userRating: z.number(),
        tmdbRatingNorm: z.number(),
        voteCount: z.number(),
        delta: z.number(),
        posterPath: safeString.nullable().optional()
      })
    ),
    biggestUnderrates: z.array(
      z.object({
        filmKey: safeString,
        title: safeString,
        userRating: z.number(),
        tmdbRatingNorm: z.number(),
        voteCount: z.number(),
        delta: z.number(),
        posterPath: safeString.nullable().optional()
      })
    ),
    contrarianByGenre: z.array(
      z.object({
        genre: safeString,
        contrarianScore: z.number(),
        n: z.number().int()
      })
    ),
    contrarianByDecade: z.array(
      z.object({
        decade: z.number().int(),
        contrarianScore: z.number(),
        n: z.number().int()
      })
    )
  }),
  s6: z.object({
    genreAffinity: z.array(
      z.object({
        name: safeString,
        n: z.number().int(),
        rawMean: z.number(),
        shrunkMean: z.number(),
        relativeToOverall: z.number()
      })
    ),
    decadeAffinity: z.array(
      z.object({
        name: safeString,
        n: z.number().int(),
        rawMean: z.number(),
        shrunkMean: z.number(),
        relativeToOverall: z.number()
      })
    ),
    countryAffinity: z.array(
      z.object({
        name: safeString,
        n: z.number().int(),
        rawMean: z.number(),
        shrunkMean: z.number(),
        relativeToOverall: z.number()
      })
    ),
    languageAffinity: z.array(
      z.object({
        name: safeString,
        n: z.number().int(),
        rawMean: z.number(),
        shrunkMean: z.number(),
        relativeToOverall: z.number()
      })
    ),
    eraDrift: z.array(
      z.object({
        watchYear: z.number().int(),
        medianFilmAge: z.number(),
        newReleasePercent: z.number(),
        medianReleaseYear: z.number().int()
      })
    ),
    hipsterIndex: z.number(),
    runtimePreferences: z.array(
      z.object({
        bucket: safeString,
        min: z.number(),
        max: z.number(),
        count: z.number().int(),
        avgRating: z.number()
      })
    ),
    keywordThemes: z.array(
      z.object({
        keyword: safeString,
        count: z.number().int(),
        avgRating: z.number()
      })
    ),
    certificationDistribution: z.array(
      z.object({
        cert: safeString,
        count: z.number().int(),
        avgRating: z.number()
      })
    )
  }),
  s7: z.object({
    directors: z.array(
      z.object({
        person: z.object({ id: z.number().int(), name: safeString, profilePath: safeString.nullable().optional() }),
        count: z.number().int(),
        avgRating: z.number(),
        shrunkRating: z.number()
      })
    ),
    actors: z.array(
      z.object({
        person: z.object({ id: z.number().int(), name: safeString, profilePath: safeString.nullable().optional() }),
        count: z.number().int(),
        avgRating: z.number(),
        shrunkRating: z.number()
      })
    ),
    actresses: z.array(
      z.object({
        person: z.object({ id: z.number().int(), name: safeString, profilePath: safeString.nullable().optional() }),
        count: z.number().int(),
        avgRating: z.number(),
        shrunkRating: z.number()
      })
    ),
    writers: z.array(
      z.object({
        person: z.object({ id: z.number().int(), name: safeString, profilePath: safeString.nullable().optional() }),
        count: z.number().int(),
        avgRating: z.number(),
        shrunkRating: z.number()
      })
    ),
    cinematographers: z.array(
      z.object({
        person: z.object({ id: z.number().int(), name: safeString, profilePath: safeString.nullable().optional() }),
        count: z.number().int(),
        avgRating: z.number(),
        shrunkRating: z.number()
      })
    ),
    composers: z.array(
      z.object({
        person: z.object({ id: z.number().int(), name: safeString, profilePath: safeString.nullable().optional() }),
        count: z.number().int(),
        avgRating: z.number(),
        shrunkRating: z.number()
      })
    )
  }),
  s8: z.object({
    countries: z.array(
      z.object({
        isoCode: safeString,
        name: safeString,
        count: z.number().int(),
        avgRating: z.number()
      })
    ),
    languages: z.array(
      z.object({
        isoCode: safeString,
        name: safeString,
        count: z.number().int(),
        avgRating: z.number()
      })
    ),
    nonEnglishShareByYear: z.array(
      z.object({
        year: z.number().int(),
        nonEnglishPercent: z.number()
      })
    )
  }),
  s9: z.object({
    genres: z.array(
      z.object({
        name: safeString,
        count: z.number().int(),
        hours: z.number(),
        avgRating: z.number()
      })
    ),
    decades: z.array(
      z.object({
        decade: z.number().int(),
        count: z.number().int(),
        avgRating: z.number()
      })
    ),
    oldestFilms: z.array(
      z.object({
        name: safeString,
        year: z.number().int().optional(),
        rating: z.number().optional()
      })
    ),
    newestFilms: z.array(
      z.object({
        name: safeString,
        year: z.number().int().optional(),
        rating: z.number().optional()
      })
    )
  }),
  s10: z.object({
    rewatchRate: z.number(),
    daysBetweenRewatches: z.number(),
    topRewatched: z.array(
      z.object({
        name: safeString,
        year: z.number().int().optional(),
        count: z.number().int(),
        rating: z.number().optional()
      })
    )
  }),
  s11: z.object({
    reviewsCount: z.number().int(),
    totalWords: z.number().int(),
    avgWordsPerReview: z.number(),
    topWords: z.array(
      z.object({
        word: safeString,
        count: z.number().int()
      })
    ),
    tags: z.array(
      z.object({
        tag: safeString,
        count: z.number().int(),
        avgRating: z.number()
      })
    ),
    likedStats: z.object({
      totalLiked: z.number().int(),
      shareLiked: z.number()
    })
  }),
  s12: z.object({
    totalCount: z.number().int(),
    backlogHours: z.number(),
    yearsToClearAtPace: z.number(),
    predictions: z.array(
      z.object({
        name: safeString,
        year: z.number().int().optional(),
        predictedRating: z.number(),
        topFactors: z.array(safeString)
      })
    ),
    predictionModelMae: z.number(),
    ageDistribution: z.array(
      z.object({
        ageBucket: safeString,
        count: z.number().int()
      })
    )
  }),
  s13: z.object({
    longestFilm: z.object({ name: safeString, year: z.number().int().optional(), runtime: z.number().int().optional() }).optional(),
    shortestFilm: z.object({ name: safeString, year: z.number().int().optional(), runtime: z.number().int().optional() }).optional(),
    oldestFilm: z.object({ name: safeString, year: z.number().int().optional() }).optional(),
    newestFilm: z.object({ name: safeString, year: z.number().int().optional() }).optional(),
    mostPopularFilm: z.object({ name: safeString, year: z.number().int().optional() }).optional(),
    leastPopularFilm: z.object({ name: safeString, year: z.number().int().optional() }).optional(),
    peakDayDate: safeString.optional(),
    peakDayCount: z.number().int().default(0),
    peakMonthYear: safeString.optional(),
    peakMonthCount: z.number().int().default(0)
  })
});

export type FullSharedPayload = z.infer<typeof FullSharedSchema>;

export type SharedPayload = CompactSharedPayload | FullSharedPayload;

// ---------------------------------------------------------------------------
// Encoding Functions
// ---------------------------------------------------------------------------

export function encodeSharedSnapshot(
  snapshot: AnalyticsSnapshot,
  profile?: Profile,
  preset: 'compact' | 'full' = 'full'
): string {
  const username = profile?.username || 'cinema_lover';

  let rawObject: unknown;

  if (preset === 'compact') {
    const compactActivityDates: Record<string, number> = {};
    (snapshot.s3Volume.trailing365Calendar || []).forEach((c) => {
      if (c.count > 0) compactActivityDates[c.date] = c.count;
    });

    const compact: CompactSharedPayload = {
      v: 1,
      type: 'compact',
      u: username,
      tf: snapshot.s1Snapshot.totalFilms,
      tv: snapshot.s1Snapshot.totalViewings,
      tr: snapshot.s1Snapshot.totalRuntimeMinutes,
      ar: snapshot.s1Snapshot.averageRating,
      rf: snapshot.s1Snapshot.ratedFilmsCount,
      lf: snapshot.s1Snapshot.likedFilmsCount,
      rc: snapshot.s1Snapshot.reviewsCount,
      rw: snapshot.s1Snapshot.rewatchesCount,
      rwr: snapshot.s10Rewatches.rewatchRate,
      uc: snapshot.s1Snapshot.uniqueCountriesCount,
      ul: snapshot.s1Snapshot.uniqueLanguagesCount,
      ud: snapshot.s1Snapshot.uniqueDirectorsCount,
      ys: snapshot.s1Snapshot.yearsSpan,
      du: snapshot.s1Snapshot.dateUnknownCount,
      tg: snapshot.s9Genres.genres.slice(0, 5).map((g) => ({ n: g.name, c: g.count })),
      td: snapshot.s7People.directors.slice(0, 5).map((d) => ({ n: d.person.name, c: d.count, r: d.avgRating })),
      ta: snapshot.s7People.actors.slice(0, 5).map((a) => ({ n: a.person.name, c: a.count, r: a.avgRating })),
      ff: snapshot.s4Ratings.topRatedFilms.slice(0, 5).map((f) => ({ t: f.name, y: f.year, r: f.rating })),
      ba: snapshot.s2Identity.archetypes.filter((a) => a.achieved).slice(0, 3).map((a) => ({ id: a.id, n: a.name })),
      ad: Object.keys(compactActivityDates).length > 0 ? compactActivityDates : undefined,
      flt: snapshot.filter.selectedYear ? { y: snapshot.filter.selectedYear } : undefined
    };
    rawObject = compact;
  } else {
    const fullActivityDates: Record<string, number> = {};
    (snapshot.s3Volume.trailing365Calendar || []).forEach((c) => {
      if (c.count > 0) fullActivityDates[c.date] = c.count;
    });
    Object.values(snapshot.s3Volume.yearlyCalendars || {}).forEach((cells) => {
      cells.forEach((c) => {
        if (c.count > 0) fullActivityDates[c.date] = c.count;
      });
    });

    const full: FullSharedPayload = {
      v: 1,
      type: 'full',
      u: username,
      filter: snapshot.filter,
      s1: snapshot.s1Snapshot,
      s2: snapshot.s2Identity,
      s3: {
        yearlyVolume: snapshot.s3Volume.yearlyVolume.map((y) => ({
          year: y.year,
          filmsCount: y.filmsCount,
          viewingsCount: y.viewingsCount,
          runtimeMinutes: y.runtimeMinutes
        })),
        yearMonthMatrix: snapshot.s3Volume.yearMonthMatrix,
        monthSeasonality: snapshot.s3Volume.monthSeasonality,
        weekdayDistribution: snapshot.s3Volume.weekdayDistribution,
        streaks: snapshot.s3Volume.streaks,
        marathonDays: snapshot.s3Volume.marathonDays.slice(0, 5).map((m) => ({
          date: m.date,
          count: m.count,
          runtimeMinutes: m.runtimeMinutes
        })),
        backlogLoggingLag: snapshot.s3Volume.backlogLoggingLag,
        activityDates: Object.keys(fullActivityDates).length > 0 ? fullActivityDates : undefined
      },
      s4: {
        histogram: snapshot.s4Ratings.histogram,
        mean: snapshot.s4Ratings.mean,
        median: snapshot.s4Ratings.median,
        mode: snapshot.s4Ratings.mode,
        standardDeviation: snapshot.s4Ratings.standardDeviation,
        harshestYear: snapshot.s4Ratings.harshestYear,
        mostGenerousYear: snapshot.s4Ratings.mostGenerousYear,
        likedVsRated: {
          likedShareByRating: snapshot.s4Ratings.likedVsRated.likedShareByRating,
          unlikedFiveStars: snapshot.s4Ratings.likedVsRated.unlikedFiveStars.slice(0, 10).map((f) => ({
            name: f.name,
            year: f.year,
            rating: f.rating
          })),
          likedLowRated: snapshot.s4Ratings.likedVsRated.likedLowRated.slice(0, 10).map((f) => ({
            name: f.name,
            year: f.year,
            rating: f.rating
          }))
        },
        rewatchRatingDelta: snapshot.s4Ratings.rewatchRatingDelta,
        topRatedFilms: snapshot.s4Ratings.topRatedFilms.slice(0, 10).map((f) => ({
          name: f.name,
          year: f.year,
          rating: f.rating
        })),
        lowestRatedFilms: snapshot.s4Ratings.lowestRatedFilms.slice(0, 10).map((f) => ({
          name: f.name,
          year: f.year,
          rating: f.rating
        }))
      },
      s5: {
        contrarianIndex: snapshot.s5Crowd.contrarianIndex,
        generosityIndex: snapshot.s5Crowd.generosityIndex,
        correlationR: snapshot.s5Crowd.correlationR,
        meanDelta: snapshot.s5Crowd.meanDelta,
        biggestOverrates: snapshot.s5Crowd.biggestOverrates.slice(0, 5),
        biggestUnderrates: snapshot.s5Crowd.biggestUnderrates.slice(0, 5),
        contrarianByGenre: snapshot.s5Crowd.contrarianByGenre.slice(0, 8),
        contrarianByDecade: snapshot.s5Crowd.contrarianByDecade.slice(0, 8)
      },
      s6: {
        genreAffinity: snapshot.s6Taste.genreAffinity.slice(0, 10),
        decadeAffinity: snapshot.s6Taste.decadeAffinity.slice(0, 10),
        countryAffinity: snapshot.s6Taste.countryAffinity.slice(0, 8),
        languageAffinity: snapshot.s6Taste.languageAffinity.slice(0, 8),
        eraDrift: snapshot.s6Taste.eraDrift,
        hipsterIndex: snapshot.s6Taste.hipsterIndex,
        runtimePreferences: snapshot.s6Taste.runtimePreferences,
        keywordThemes: snapshot.s6Taste.keywordThemes.slice(0, 15),
        certificationDistribution: snapshot.s6Taste.certificationDistribution.slice(0, 6)
      },
      s7: {
        directors: snapshot.s7People.directors.slice(0, 12).map((p) => ({
          person: p.person,
          count: p.count,
          avgRating: p.avgRating,
          shrunkRating: p.shrunkRating
        })),
        actors: snapshot.s7People.actors.slice(0, 12).map((p) => ({
          person: p.person,
          count: p.count,
          avgRating: p.avgRating,
          shrunkRating: p.shrunkRating
        })),
        actresses: snapshot.s7People.actresses.slice(0, 12).map((p) => ({
          person: p.person,
          count: p.count,
          avgRating: p.avgRating,
          shrunkRating: p.shrunkRating
        })),
        writers: snapshot.s7People.writers.slice(0, 6).map((p) => ({
          person: p.person,
          count: p.count,
          avgRating: p.avgRating,
          shrunkRating: p.shrunkRating
        })),
        cinematographers: snapshot.s7People.cinematographers.slice(0, 6).map((p) => ({
          person: p.person,
          count: p.count,
          avgRating: p.avgRating,
          shrunkRating: p.shrunkRating
        })),
        composers: snapshot.s7People.composers.slice(0, 6).map((p) => ({
          person: p.person,
          count: p.count,
          avgRating: p.avgRating,
          shrunkRating: p.shrunkRating
        }))
      },
      s8: {
        countries: snapshot.s8World.countries.slice(0, 15).map((c) => ({
          isoCode: c.isoCode,
          name: c.name,
          count: c.count,
          avgRating: c.avgRating
        })),
        languages: snapshot.s8World.languages.slice(0, 10).map((l) => ({
          isoCode: l.isoCode,
          name: l.name,
          count: l.count,
          avgRating: l.avgRating
        })),
        nonEnglishShareByYear: snapshot.s8World.nonEnglishShareByYear
      },
      s9: {
        genres: snapshot.s9Genres.genres.slice(0, 15),
        decades: snapshot.s9Genres.decades.slice(0, 10),
        oldestFilms: snapshot.s9Genres.oldestFilms.slice(0, 5).map((f) => ({
          name: f.name,
          year: f.year,
          rating: f.rating
        })),
        newestFilms: snapshot.s9Genres.newestFilms.slice(0, 5).map((f) => ({
          name: f.name,
          year: f.year,
          rating: f.rating
        }))
      },
      s10: {
        rewatchRate: snapshot.s10Rewatches.rewatchRate,
        daysBetweenRewatches: snapshot.s10Rewatches.daysBetweenRewatches,
        topRewatched: snapshot.s10Rewatches.topRewatched.slice(0, 10).map((r) => ({
          name: r.film.name,
          year: r.film.year,
          count: r.count,
          rating: r.film.rating
        }))
      },
      s11: {
        reviewsCount: snapshot.s11WordsLists.reviewsCount,
        totalWords: snapshot.s11WordsLists.totalWords,
        avgWordsPerReview: snapshot.s11WordsLists.avgWordsPerReview,
        topWords: snapshot.s11WordsLists.topWords.slice(0, 15),
        tags: snapshot.s11WordsLists.tags.slice(0, 10),
        likedStats: snapshot.s11WordsLists.likedStats
      },
      s12: {
        totalCount: snapshot.s12Watchlist.totalCount,
        backlogHours: snapshot.s12Watchlist.backlogHours,
        yearsToClearAtPace: snapshot.s12Watchlist.yearsToClearAtPace,
        predictions: snapshot.s12Watchlist.predictions.slice(0, 5).map((p) => ({
          name: p.film.name,
          year: p.film.year,
          predictedRating: p.predictedRating,
          topFactors: p.topFactors
        })),
        predictionModelMae: snapshot.s12Watchlist.predictionModelMae,
        ageDistribution: snapshot.s12Watchlist.ageDistribution
      },
      s13: {
        longestFilm: snapshot.s13Records.longestFilm
          ? {
              name: snapshot.s13Records.longestFilm.name,
              year: snapshot.s13Records.longestFilm.year,
              runtime: snapshot.s13Records.longestFilm.metadata?.runtime
            }
          : undefined,
        shortestFilm: snapshot.s13Records.shortestFilm
          ? {
              name: snapshot.s13Records.shortestFilm.name,
              year: snapshot.s13Records.shortestFilm.year,
              runtime: snapshot.s13Records.shortestFilm.metadata?.runtime
            }
          : undefined,
        oldestFilm: snapshot.s13Records.oldestFilm
          ? { name: snapshot.s13Records.oldestFilm.name, year: snapshot.s13Records.oldestFilm.year }
          : undefined,
        newestFilm: snapshot.s13Records.newestFilm
          ? { name: snapshot.s13Records.newestFilm.name, year: snapshot.s13Records.newestFilm.year }
          : undefined,
        mostPopularFilm: snapshot.s13Records.mostPopularFilm
          ? { name: snapshot.s13Records.mostPopularFilm.name, year: snapshot.s13Records.mostPopularFilm.year }
          : undefined,
        leastPopularFilm: snapshot.s13Records.leastPopularFilm
          ? { name: snapshot.s13Records.leastPopularFilm.name, year: snapshot.s13Records.leastPopularFilm.year }
          : undefined,
        peakDayDate: snapshot.s13Records.peakDayDate,
        peakDayCount: snapshot.s13Records.peakDayCount,
        peakMonthYear: snapshot.s13Records.peakMonthYear,
        peakMonthCount: snapshot.s13Records.peakMonthCount
      }
    };
    rawObject = full;
  }

  const json = JSON.stringify(rawObject);
  const u8 = fflate.strToU8(json);
  const deflated = fflate.deflateSync(u8, { level: 9 });
  const b64 = uint8ArrayToBase64Url(deflated);

  return `#v1=${b64}`;
}

// ---------------------------------------------------------------------------
// Safe Decoding & Prototype Pollution Defense
// ---------------------------------------------------------------------------

export function decodeSharedSnapshot(fragment: string): SharedPayload {
  let clean = fragment.trim();
  if (clean.startsWith('#')) {
    clean = clean.slice(1);
  }
  if (clean.startsWith('v1=')) {
    clean = clean.slice(3);
  }

  // Safety limits: max encoded length 12,000 characters
  if (clean.length === 0 || clean.length > 12000) {
    throw new Error('Fragment payload size exceeds safety bounds');
  }

  const compressedBytes = base64UrlToUint8Array(clean);

  // Decompress raw DEFLATE bytes
  let decompressedBytes: Uint8Array;
  try {
    decompressedBytes = fflate.inflateSync(compressedBytes);
  } catch (err) {
    throw new Error(`Decompression failed: ${(err as Error).message}`);
  }

  // Decompression bomb guard: max decompressed 300 KB
  if (decompressedBytes.byteLength > 300 * 1024) {
    throw new Error('Decompressed payload size exceeds safety threshold');
  }

  const jsonStr = fflate.strFromU8(decompressedBytes);

  // Prototype pollution attack detection
  if (
    jsonStr.includes('__proto__') ||
    jsonStr.includes('constructor') ||
    jsonStr.includes('prototype')
  ) {
    throw new Error('Malicious object properties detected');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error('Invalid JSON format');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Invalid payload structure');
  }

  const obj = parsed as Record<string, unknown>;

  if (obj.type === 'compact') {
    return CompactSharedSchema.parse(obj);
  } else if (obj.type === 'full') {
    return FullSharedSchema.parse(obj);
  }

  throw new Error(`Unsupported payload type: ${String(obj.type)}`);
}

// ---------------------------------------------------------------------------
// Async Decompressor (with Web Worker fallback or async setTimeout)
// ---------------------------------------------------------------------------

export async function decompressSharedSnapshotAsync(
  fragment: string
): Promise<SharedPayload | null> {
  return new Promise((resolve) => {
    // Run in macrotask to avoid blocking initial render
    setTimeout(() => {
      try {
        const payload = decodeSharedSnapshot(fragment);
        resolve(payload);
      } catch (err) {
        console.warn('Failed to decode shared stats link:', err);
        resolve(null);
      }
    }, 0);
  });
}

// ---------------------------------------------------------------------------
// Adapter: Shared Payload to Renderable State
// ---------------------------------------------------------------------------

function reconstructCalendars(
  activityDates: Record<string, number> = {},
  years: number[] = []
): {
  trailing365Calendar: HeatmapDayCell[];
  yearlyCalendars: Record<number, HeatmapDayCell[]>;
} {
  const todayStr = getTodayCalendarDate();
  const trailing365Calendar: HeatmapDayCell[] = [];
  const startTrailing = addDays(todayStr, -364);

  for (let i = 0; i < 365; i++) {
    const d = addDays(startTrailing, i);
    const count = activityDates[d] || 0;
    const p = parseCalendarDate(d) || { year: 2024, month: 1, day: 1 };
    trailing365Calendar.push({
      date: d,
      count,
      weekday: getWeekday(d),
      month: p.month,
      year: p.year,
      filmKeys: []
    });
  }

  const yearSet = new Set<number>(years);
  Object.keys(activityDates).forEach((d) => {
    const yr = parseInt(d.slice(0, 4), 10);
    if (!isNaN(yr) && yr >= 1900 && yr <= 2100) {
      yearSet.add(yr);
    }
  });

  const yearlyCalendars: Record<number, HeatmapDayCell[]> = {};
  Array.from(yearSet).sort((a, b) => a - b).forEach((year) => {
    const daysInYr = isLeapYear(year) ? 366 : 365;
    const startYr = `${year}-01-01`;
    const yrCells: HeatmapDayCell[] = [];
    for (let i = 0; i < daysInYr; i++) {
      const d = addDays(startYr, i);
      const count = activityDates[d] || 0;
      const p = parseCalendarDate(d) || { year, month: 1, day: 1 };
      yrCells.push({
        date: d,
        count,
        weekday: getWeekday(d),
        month: p.month,
        year: p.year,
        filmKeys: []
      });
    }
    yearlyCalendars[year] = yrCells;
  });

  return { trailing365Calendar, yearlyCalendars };
}

export function sharedPayloadToSnapshot(payload: SharedPayload): {
  snapshot: AnalyticsSnapshot;
  profile: Profile;
  films: Record<string, Film>;
} {
  const profile: Profile = {
    username: payload.u,
    givenName: payload.u,
    bio: 'Letterboxd Film Enthusiast',
    favoriteFilmUris: []
  };

  const films: Record<string, Film> = {};

  if (payload.type === 'compact') {
    // Populate dummy films from favorite films
    payload.ff.forEach((f, idx) => {
      const uri = `shared://favorite/${idx}`;
      films[uri] = {
        letterboxdUri: uri,
        name: f.t,
        year: f.y,
        rating: f.r,
        watched: true,
        liked: true,
        onWatchlist: false,
        match: { status: 'confident', score: 1 }
      };
      profile.favoriteFilmUris.push(uri);
    });

    const s1: S1Snapshot = {
      totalFilms: payload.tf,
      totalViewings: payload.tv,
      totalRuntimeMinutes: payload.tr,
      runtimeCoveragePercent: 100,
      averageRating: payload.ar,
      ratingCoveragePercent: Math.round((payload.rf / (payload.tf || 1)) * 100),
      ratedFilmsCount: payload.rf,
      reviewsCount: payload.rc,
      rewatchesCount: payload.rw,
      likedFilmsCount: payload.lf,
      uniqueCountriesCount: payload.uc,
      uniqueLanguagesCount: payload.ul,
      uniqueDirectorsCount: payload.ud,
      yearsSpan: payload.ys,
      earliestWatchDate: null,
      latestWatchDate: null,
      dateUnknownCount: payload.du
    };

    const s2: S2Identity = {
      archetypes: payload.ba.map((b) => ({
        id: b.id,
        name: b.n,
        description: 'Recognized cinema viewing archetype',
        thresholdLabel: 'Achieved',
        valueLabel: '100%',
        achieved: true
      })),
      insights: []
    };

    const s4Ratings = {
      histogram: [],
      mean: payload.ar,
      median: payload.ar,
      mode: Math.round(payload.ar),
      standardDeviation: 0.8,
      rollingRatingMonthly: [],
      byReleaseDecade: [],
      byReleaseYear: [],
      harshestYear: null,
      mostGenerousYear: null,
      likedVsRated: {
        likedShareByRating: [],
        unlikedFiveStars: [],
        likedLowRated: []
      },
      rewatchRatingDelta: {
        averageDelta: 0,
        totalRewatched: payload.rw,
        higherCount: 0,
        sameCount: payload.rw,
        lowerCount: 0
      },
      topRatedFilms: Object.values(films),
      lowestRatedFilms: []
    };

    const s7People = {
      directors: payload.td.map((d, idx) => ({
        person: { id: 1000 + idx, name: d.n },
        count: d.c,
        avgRating: d.r,
        shrunkRating: d.r,
        filmKeys: []
      })),
      actors: payload.ta.map((a, idx) => ({
        person: { id: 2000 + idx, name: a.n },
        count: a.c,
        avgRating: a.r,
        shrunkRating: a.r,
        filmKeys: []
      })),
      actresses: [],
      allCast: [],
      writers: [],
      cinematographers: [],
      composers: [],
      editors: [],
      producers: [],
      studios: [],
      uniqueDirectorsCount: payload.ud,
      singleFilmDirectorsShare: 0,
      directorActorPairs: []
    };

    const s9Genres = {
      genres: payload.tg.map((g) => ({
        name: g.n,
        count: g.c,
        hours: Math.round((g.c * 105) / 60),
        avgRating: payload.ar
      })),
      decades: [],
      oldestFilms: [],
      newestFilms: []
    };

    const { trailing365Calendar, yearlyCalendars } = reconstructCalendars(
      payload.ad,
      payload.flt?.y ? [payload.flt.y] : []
    );

    const snapshot: AnalyticsSnapshot = {
      calculatedAt: Date.now(),
      filter: { range: payload.flt?.y ? 'year' : 'all', selectedYear: payload.flt?.y },
      s1Snapshot: s1,
      s2Identity: s2,
      s3Volume: {
        yearlyVolume: [],
        yearMonthMatrix: [],
        monthSeasonality: [],
        weekdayDistribution: [],
        trailing365Calendar,
        yearlyCalendars,
        streaks: {
          currentStreakDays: 0,
          isCurrentStreakActive: false,
          longestStreakDays: 0,
          longestGapDays: 0
        },
        busiestDay: null,
        busiestMonth: null,
        marathonDays: [],
        currentYearPace: { projectedFilms: 0, filmsSoFar: 0, dayOfYear: 1, daysInYear: 365 },
        backlogLoggingLag: [],
        dateUnknownCount: payload.du
      },
      s4Ratings,
      s5Crowd: {
        scatterPoints: [],
        correlationR: null,
        meanDelta: 0,
        biggestOverrates: [],
        biggestUnderrates: [],
        contrarianIndex: 0,
        generosityIndex: 0,
        contrarianByGenre: [],
        contrarianByDecade: []
      },
      s6Taste: {
        genreAffinity: [],
        decadeAffinity: [],
        countryAffinity: [],
        languageAffinity: [],
        genreMixOverTime: [],
        eraDrift: [],
        popularityScatter: [],
        hipsterIndex: 0,
        runtimePreferences: [],
        shannonDiversityByYear: [],
        keywordThemes: [],
        decadeGenreMatrix: [],
        certificationDistribution: []
      },
      s7People,
      s8World: { countries: [], languages: [], nonEnglishShareByYear: [] },
      s9Genres,
      s10Rewatches: {
        rewatchRate: payload.rwr,
        topRewatched: [],
        daysBetweenRewatches: 0
      },
      s11WordsLists: {
        reviewsCount: payload.rc,
        totalWords: payload.rc * 50,
        avgWordsPerReview: 50,
        topWords: [],
        tags: [],
        listsProgress: [],
        likedStats: { totalLiked: payload.lf, shareLiked: Math.round((payload.lf / (payload.tf || 1)) * 100) }
      },
      s12Watchlist: {
        totalCount: 0,
        backlogHours: 0,
        yearsToClearAtPace: 0,
        predictions: [],
        predictionModelMae: 0,
        ageDistribution: []
      },
      s13Records: {
        peakDayCount: 0,
        peakMonthCount: 0
      }
    };

    return { snapshot, profile, films };
  }

  // Full snapshot payload reconstruction
  // Create mock films from top rated, unliked, lowest rated, rewatched
  const mockFilmsList: Array<{ name: string; year?: number; rating?: number; posterPath?: string | null }> = [
    ...payload.s4.topRatedFilms,
    ...payload.s4.lowestRatedFilms,
    ...payload.s4.likedVsRated.unlikedFiveStars,
    ...payload.s4.likedVsRated.likedLowRated,
    ...payload.s9.oldestFilms,
    ...payload.s9.newestFilms,
    ...payload.s10.topRewatched
  ];

  mockFilmsList.forEach((f, idx) => {
    const uri = `shared://film/${idx}/${encodeURIComponent(f.name)}`;
    if (!films[uri]) {
      films[uri] = {
        letterboxdUri: uri,
        name: f.name,
        year: f.year,
        rating: f.rating || payload.s1.averageRating,
        watched: true,
        liked: (f.rating || 0) >= 4,
        onWatchlist: false,
        match: { status: 'confident', score: 1 },
        metadata: createMockMovieMetadata(idx, f.name, f.year, 110)
      };
    }
  });

  const { trailing365Calendar, yearlyCalendars } = reconstructCalendars(
    payload.s3.activityDates,
    payload.s3.yearlyVolume.map((y) => y.year)
  );

  const snapshot: AnalyticsSnapshot = {
    calculatedAt: Date.now(),
    filter: payload.filter as TimeFilter,
    s1Snapshot: payload.s1,
    s2Identity: payload.s2,
    s3Volume: {
      yearlyVolume: payload.s3.yearlyVolume.map((y) => ({
        ...y,
        cumulativeFilms: y.filmsCount,
        milestones: []
      })),
      yearMonthMatrix: payload.s3.yearMonthMatrix,
      monthSeasonality: payload.s3.monthSeasonality,
      weekdayDistribution: payload.s3.weekdayDistribution,
      trailing365Calendar,
      yearlyCalendars,
      streaks: payload.s3.streaks,
      busiestDay: null,
      busiestMonth: null,
      marathonDays: payload.s3.marathonDays.map((m) => ({ ...m, filmKeys: [] })),
      currentYearPace: { projectedFilms: 0, filmsSoFar: 0, dayOfYear: 1, daysInYear: 365 },
      backlogLoggingLag: payload.s3.backlogLoggingLag,
      dateUnknownCount: payload.s1.dateUnknownCount
    },
    s4Ratings: {
      histogram: payload.s4.histogram,
      mean: payload.s4.mean,
      median: payload.s4.median,
      mode: payload.s4.mode,
      standardDeviation: payload.s4.standardDeviation,
      rollingRatingMonthly: [],
      byReleaseDecade: [],
      byReleaseYear: [],
      harshestYear: payload.s4.harshestYear,
      mostGenerousYear: payload.s4.mostGenerousYear,
      likedVsRated: {
        likedShareByRating: payload.s4.likedVsRated.likedShareByRating,
        unlikedFiveStars: payload.s4.likedVsRated.unlikedFiveStars.map((f) => ({
          letterboxdUri: `shared://film/unliked/${f.name}`,
          name: f.name,
          year: f.year,
          rating: f.rating,
          watched: true,
          liked: false,
          onWatchlist: false,
          match: { status: 'confident', score: 1 }
        })),
        likedLowRated: payload.s4.likedVsRated.likedLowRated.map((f) => ({
          letterboxdUri: `shared://film/liked_low/${f.name}`,
          name: f.name,
          year: f.year,
          rating: f.rating,
          watched: true,
          liked: true,
          onWatchlist: false,
          match: { status: 'confident', score: 1 }
        }))
      },
      rewatchRatingDelta: payload.s4.rewatchRatingDelta,
      topRatedFilms: payload.s4.topRatedFilms.map((f) => ({
        letterboxdUri: `shared://film/top/${f.name}`,
        name: f.name,
        year: f.year,
        rating: f.rating,
        watched: true,
        liked: true,
        onWatchlist: false,
        match: { status: 'confident', score: 1 }
      })),
      lowestRatedFilms: payload.s4.lowestRatedFilms.map((f) => ({
        letterboxdUri: `shared://film/lowest/${f.name}`,
        name: f.name,
        year: f.year,
        rating: f.rating,
        watched: true,
        liked: false,
        onWatchlist: false,
        match: { status: 'confident', score: 1 }
      }))
    },
    s5Crowd: {
      scatterPoints: [...payload.s5.biggestOverrates, ...payload.s5.biggestUnderrates],
      correlationR: payload.s5.correlationR,
      meanDelta: payload.s5.meanDelta,
      biggestOverrates: payload.s5.biggestOverrates,
      biggestUnderrates: payload.s5.biggestUnderrates,
      contrarianIndex: payload.s5.contrarianIndex,
      generosityIndex: payload.s5.generosityIndex,
      contrarianByGenre: payload.s5.contrarianByGenre,
      contrarianByDecade: payload.s5.contrarianByDecade
    },
    s6Taste: {
      genreAffinity: payload.s6.genreAffinity,
      decadeAffinity: payload.s6.decadeAffinity,
      countryAffinity: payload.s6.countryAffinity,
      languageAffinity: payload.s6.languageAffinity,
      genreMixOverTime: [],
      eraDrift: payload.s6.eraDrift,
      popularityScatter: [],
      hipsterIndex: payload.s6.hipsterIndex,
      runtimePreferences: payload.s6.runtimePreferences,
      shannonDiversityByYear: [],
      keywordThemes: payload.s6.keywordThemes,
      decadeGenreMatrix: [],
      certificationDistribution: payload.s6.certificationDistribution
    },
    s7People: {
      directors: payload.s7.directors.map((d) => ({ ...d, filmKeys: [] })),
      actors: payload.s7.actors.map((a) => ({ ...a, filmKeys: [] })),
      actresses: payload.s7.actresses.map((a) => ({ ...a, filmKeys: [] })),
      allCast: [],
      writers: payload.s7.writers.map((w) => ({ ...w, filmKeys: [] })),
      cinematographers: payload.s7.cinematographers.map((c) => ({ ...c, filmKeys: [] })),
      composers: payload.s7.composers.map((c) => ({ ...c, filmKeys: [] })),
      editors: [],
      producers: [],
      studios: [],
      uniqueDirectorsCount: payload.s1.uniqueDirectorsCount,
      singleFilmDirectorsShare: 0,
      directorActorPairs: []
    },
    s8World: {
      countries: payload.s8.countries.map((c) => ({ ...c, filmKeys: [] })),
      languages: payload.s8.languages.map((l) => ({ ...l, filmKeys: [] })),
      nonEnglishShareByYear: payload.s8.nonEnglishShareByYear
    },
    s9Genres: {
      genres: payload.s9.genres,
      decades: payload.s9.decades,
      oldestFilms: payload.s9.oldestFilms.map((f) => ({
        letterboxdUri: `shared://film/oldest/${f.name}`,
        name: f.name,
        year: f.year,
        rating: f.rating,
        watched: true,
        liked: false,
        onWatchlist: false,
        match: { status: 'confident', score: 1 }
      })),
      newestFilms: payload.s9.newestFilms.map((f) => ({
        letterboxdUri: `shared://film/newest/${f.name}`,
        name: f.name,
        year: f.year,
        rating: f.rating,
        watched: true,
        liked: false,
        onWatchlist: false,
        match: { status: 'confident', score: 1 }
      }))
    },
    s10Rewatches: {
      rewatchRate: payload.s10.rewatchRate,
      daysBetweenRewatches: payload.s10.daysBetweenRewatches,
      topRewatched: payload.s10.topRewatched.map((r) => ({
        film: {
          letterboxdUri: `shared://film/rewatched/${r.name}`,
          name: r.name,
          year: r.year,
          rating: r.rating || payload.s1.averageRating,
          watched: true,
          liked: false,
          onWatchlist: false,
          match: { status: 'confident', score: 1 }
        },
        count: r.count
      }))
    },
    s11WordsLists: {
      reviewsCount: payload.s11.reviewsCount,
      totalWords: payload.s11.totalWords,
      avgWordsPerReview: payload.s11.avgWordsPerReview,
      topWords: payload.s11.topWords,
      tags: payload.s11.tags,
      listsProgress: [],
      likedStats: payload.s11.likedStats
    },
    s12Watchlist: {
      totalCount: payload.s12.totalCount,
      backlogHours: payload.s12.backlogHours,
      yearsToClearAtPace: payload.s12.yearsToClearAtPace,
      predictions: payload.s12.predictions.map((p) => ({
        film: {
          letterboxdUri: `shared://film/pred/${p.name}`,
          name: p.name,
          year: p.year,
          watched: false,
          liked: false,
          onWatchlist: true,
          match: { status: 'confident', score: 1 }
        },
        predictedRating: p.predictedRating,
        topFactors: p.topFactors
      })),
      predictionModelMae: payload.s12.predictionModelMae,
      ageDistribution: payload.s12.ageDistribution
    },
    s13Records: {
      longestFilm: payload.s13.longestFilm
        ? {
            letterboxdUri: 'shared://records/longest',
            name: payload.s13.longestFilm.name,
            year: payload.s13.longestFilm.year,
            watched: true,
            liked: false,
            onWatchlist: false,
            match: { status: 'confident', score: 1 },
            metadata: createMockMovieMetadata(
              99991,
              payload.s13.longestFilm.name,
              payload.s13.longestFilm.year,
              payload.s13.longestFilm.runtime || 180
            )
          }
        : undefined,
      shortestFilm: payload.s13.shortestFilm
        ? {
            letterboxdUri: 'shared://records/shortest',
            name: payload.s13.shortestFilm.name,
            year: payload.s13.shortestFilm.year,
            watched: true,
            liked: false,
            onWatchlist: false,
            match: { status: 'confident', score: 1 },
            metadata: createMockMovieMetadata(
              99992,
              payload.s13.shortestFilm.name,
              payload.s13.shortestFilm.year,
              payload.s13.shortestFilm.runtime || 15
            )
          }
        : undefined,
      oldestFilm: payload.s13.oldestFilm
        ? {
            letterboxdUri: 'shared://records/oldest',
            name: payload.s13.oldestFilm.name,
            year: payload.s13.oldestFilm.year,
            watched: true,
            liked: false,
            onWatchlist: false,
            match: { status: 'confident', score: 1 }
          }
        : undefined,
      newestFilm: payload.s13.newestFilm
        ? {
            letterboxdUri: 'shared://records/newest',
            name: payload.s13.newestFilm.name,
            year: payload.s13.newestFilm.year,
            watched: true,
            liked: false,
            onWatchlist: false,
            match: { status: 'confident', score: 1 }
          }
        : undefined,
      mostPopularFilm: payload.s13.mostPopularFilm
        ? {
            letterboxdUri: 'shared://records/popular',
            name: payload.s13.mostPopularFilm.name,
            year: payload.s13.mostPopularFilm.year,
            watched: true,
            liked: false,
            onWatchlist: false,
            match: { status: 'confident', score: 1 }
          }
        : undefined,
      leastPopularFilm: payload.s13.leastPopularFilm
        ? {
            letterboxdUri: 'shared://records/least_popular',
            name: payload.s13.leastPopularFilm.name,
            year: payload.s13.leastPopularFilm.year,
            watched: true,
            liked: false,
            onWatchlist: false,
            match: { status: 'confident', score: 1 }
          }
        : undefined,
      peakDayDate: payload.s13.peakDayDate,
      peakDayCount: payload.s13.peakDayCount,
      peakMonthYear: payload.s13.peakMonthYear,
      peakMonthCount: payload.s13.peakMonthCount
    }
  };

  return { snapshot, profile, films };
}
