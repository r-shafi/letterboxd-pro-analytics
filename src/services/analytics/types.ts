/**
 * Analytics Engine Types & Interfaces
 */

import { Film, TmdbPersonCompact } from '../../types/domain.ts';

export type TimeRangeOption = 'all' | 'year' | 'custom';

export interface TimeFilter {
  range: TimeRangeOption;
  selectedYear?: number;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
}

// S1. Snapshot
export interface S1Snapshot {
  totalFilms: number;
  totalViewings: number;
  totalRuntimeMinutes: number;
  runtimeCoveragePercent: number;
  averageRating: number;
  ratingCoveragePercent: number;
  ratedFilmsCount: number;
  reviewsCount: number;
  rewatchesCount: number;
  likedFilmsCount: number;
  uniqueCountriesCount: number;
  uniqueLanguagesCount: number;
  uniqueDirectorsCount: number;
  yearsSpan: number;
  earliestWatchDate: string | null;
  latestWatchDate: string | null;
  dateUnknownCount: number;
}

// S2. Film Identity & Archetypes
export interface ArchetypeBadge {
  id: string;
  name: string;
  description: string;
  thresholdLabel: string;
  valueLabel: string;
  achieved: boolean;
}

export interface FilmInsight {
  id: string;
  headline: string;
  evidence: string;
  sampleSize: number;
  category: 'volume' | 'taste' | 'habits' | 'social';
}

export interface S2Identity {
  archetypes: ArchetypeBadge[];
  insights: FilmInsight[];
}

// S3. Volume & Rhythm
export interface YearVolume {
  year: number;
  filmsCount: number;
  viewingsCount: number;
  runtimeMinutes: number;
  cumulativeFilms: number;
  milestones: Array<{ filmNumber: number; title: string; date: string }>;
}

export interface HeatmapDayCell {
  date: string; // YYYY-MM-DD
  count: number;
  weekday: number; // 1=Mon, 7=Sun
  month: number; // 1-12
  year: number;
  filmKeys: string[];
}

export interface StreakStats {
  currentStreakDays: number;
  isCurrentStreakActive: boolean;
  longestStreakDays: number;
  longestStreakStartDate?: string;
  longestStreakEndDate?: string;
  longestGapDays: number;
  longestGapStartDate?: string;
  longestGapEndDate?: string;
}

export interface MarathonDay {
  date: string;
  count: number;
  runtimeMinutes: number;
  filmKeys: string[];
}

export interface S3Volume {
  yearlyVolume: YearVolume[];
  yearMonthMatrix: Array<{ year: number; months: number[] }>; // 12 numbers per year
  monthSeasonality: Array<{ month: number; count: number; name: string }>;
  weekdayDistribution: Array<{ weekday: number; name: string; count: number; sharePercent: number }>;
  trailing365Calendar: HeatmapDayCell[];
  yearlyCalendars: Record<number, HeatmapDayCell[]>;
  streaks: StreakStats;
  busiestDay: { date: string; count: number } | null;
  busiestMonth: { yearMonth: string; count: number } | null;
  marathonDays: MarathonDay[];
  currentYearPace: {
    projectedFilms: number;
    filmsSoFar: number;
    yearlyGoal?: number;
    dayOfYear: number;
    daysInYear: number;
  };
  backlogLoggingLag: Array<{ lagBucket: string; count: number }>;
  dateUnknownCount: number;
}

// S4. Ratings
export interface RatingBucket {
  rating: number; // 0.5 to 5.0
  count: number;
  percent: number;
}

export interface YearRatingStat {
  year: number;
  avgRating: number;
  shrunkRating: number;
  count: number;
}

export interface S4Ratings {
  histogram: RatingBucket[];
  mean: number;
  median: number;
  mode: number;
  standardDeviation: number;
  rollingRatingMonthly: Array<{ date: string; avgRating: number; count: number }>;
  byReleaseDecade: Array<{ decade: number; avgRating: number; count: number }>;
  byReleaseYear: Array<{ year: number; avgRating: number; count: number }>;
  harshestYear: YearRatingStat | null;
  mostGenerousYear: YearRatingStat | null;
  likedVsRated: {
    likedShareByRating: Array<{ rating: number; total: number; likedCount: number; percentLiked: number }>;
    unlikedFiveStars: Film[];
    likedLowRated: Film[]; // rated <= 2.5 but liked
  };
  rewatchRatingDelta: {
    averageDelta: number;
    totalRewatched: number;
    higherCount: number;
    sameCount: number;
    lowerCount: number;
  };
  topRatedFilms: Film[];
  lowestRatedFilms: Film[];
}

// S5. Crowd Comparison
export interface CrowdScatterPoint {
  filmKey: string;
  title: string;
  userRating: number;
  tmdbRatingNorm: number; // 0.5 - 5.0
  voteCount: number;
  delta: number; // user - tmdb
  posterPath?: string | null;
}

export interface S5CrowdComparison {
  scatterPoints: CrowdScatterPoint[];
  correlationR: number | null; // min n=20
  meanDelta: number;
  biggestOverrates: CrowdScatterPoint[]; // user rated higher
  biggestUnderrates: CrowdScatterPoint[]; // user rated lower
  contrarianIndex: number; // mean absolute delta
  generosityIndex: number; // mean signed delta
  contrarianByGenre: Array<{ genre: string; contrarianScore: number; n: number }>;
  contrarianByDecade: Array<{ decade: number; contrarianScore: number; n: number }>;
}

// S6. Taste Profile
export interface TasteAffinityGroup {
  name: string;
  n: number;
  rawMean: number;
  shrunkMean: number;
  relativeToOverall: number;
}

export interface S6TasteProfile {
  genreAffinity: TasteAffinityGroup[];
  decadeAffinity: TasteAffinityGroup[];
  countryAffinity: TasteAffinityGroup[];
  languageAffinity: TasteAffinityGroup[];
  genreMixOverTime: Array<{ year: number; genreShares: Record<string, number> }>;
  eraDrift: Array<{
    watchYear: number;
    medianFilmAge: number;
    newReleasePercent: number;
    medianReleaseYear: number;
  }>;
  popularityScatter: Array<{
    filmKey: string;
    title: string;
    userRating: number;
    popularity: number;
    voteCount: number;
  }>;
  hipsterIndex: number; // % films with popularity < 20
  runtimePreferences: Array<{
    bucket: string;
    min: number;
    max: number;
    count: number;
    avgRating: number;
  }>;
  shannonDiversityByYear: Array<{
    year: number;
    genreEntropy: number;
    countryEntropy: number;
    languageEntropy: number;
  }>;
  keywordThemes: Array<{
    keyword: string;
    count: number;
    avgRating: number;
  }>;
  decadeGenreMatrix: Array<{
    decade: number;
    genres: Record<string, number>;
  }>;
  certificationDistribution: Array<{
    cert: string;
    count: number;
    avgRating: number;
  }>;
}

// S7. People
export interface RankedPerson {
  person: TmdbPersonCompact;
  count: number;
  avgRating: number;
  shrunkRating: number;
  filmKeys: string[];
}

export interface S7People {
  directors: RankedPerson[];
  actors: RankedPerson[];
  actresses: RankedPerson[];
  allCast: RankedPerson[];
  writers: RankedPerson[];
  cinematographers: RankedPerson[];
  composers: RankedPerson[];
  editors: RankedPerson[];
  producers: RankedPerson[];
  studios: Array<{ id: number; name: string; count: number; avgRating: number; filmKeys: string[] }>;
  uniqueDirectorsCount: number;
  singleFilmDirectorsShare: number;
  directorActorPairs: Array<{
    directorName: string;
    actorName: string;
    pairCount: number;
    filmKeys: string[];
  }>;
}

// S8. World
export interface CountryStats {
  isoCode: string;
  name: string;
  count: number;
  avgRating: number;
  filmKeys: string[];
}

export interface LanguageStats {
  isoCode: string;
  name: string;
  count: number;
  avgRating: number;
  filmKeys: string[];
}

export interface S8World {
  countries: CountryStats[];
  languages: LanguageStats[];
  nonEnglishShareByYear: Array<{ year: number; nonEnglishPercent: number }>;
}

// S9. Genres & Decades
export interface S9GenresDecades {
  genres: Array<{ name: string; count: number; hours: number; avgRating: number }>;
  decades: Array<{ decade: number; count: number; avgRating: number }>;
  oldestFilms: Film[];
  newestFilms: Film[];
}

// S10. Rewatches
export interface S10Rewatches {
  rewatchRate: number; // percentage
  topRewatched: Array<{ film: Film; count: number }>;
  daysBetweenRewatches: number; // average
}

// S11. Words, Tags, Lists, Likes
export interface S11WordsTagsLists {
  reviewsCount: number;
  totalWords: number;
  avgWordsPerReview: number;
  longestReview?: { film: Film; wordCount: number; review: string };
  topWords: Array<{ word: string; count: number }>;
  tags: Array<{ tag: string; count: number; avgRating: number }>;
  listsProgress: Array<{
    slug: string;
    name: string;
    totalItems: number;
    seenItems: number;
    percentSeen: number;
  }>;
  likedStats: {
    totalLiked: number;
    shareLiked: number;
  };
}

// S12. Watchlist
export interface PredictedWatchlistItem {
  film: Film;
  predictedRating: number;
  topFactors: string[];
}

export interface S12Watchlist {
  totalCount: number;
  backlogHours: number;
  yearsToClearAtPace: number;
  predictions: PredictedWatchlistItem[];
  predictionModelMae: number; // Mean Absolute Error
  ageDistribution: Array<{ ageBucket: string; count: number }>;
}

// S13. Records
export interface S13Records {
  longestFilm?: Film;
  shortestFilm?: Film;
  oldestFilm?: Film;
  newestFilm?: Film;
  mostPopularFilm?: Film;
  leastPopularFilm?: Film;
  biggestCrowdDisagreement?: { film: Film; delta: number };
  peakDayDate?: string;
  peakDayCount: number;
  peakMonthYear?: string;
  peakMonthCount: number;
}

export interface AnalyticsSnapshot {
  calculatedAt: number;
  filter: TimeFilter;
  s1Snapshot: S1Snapshot;
  s2Identity: S2Identity;
  s3Volume: S3Volume;
  s4Ratings: S4Ratings;
  s5Crowd: S5CrowdComparison;
  s6Taste: S6TasteProfile;
  s7People: S7People;
  s8World: S8World;
  s9Genres: S9GenresDecades;
  s10Rewatches: S10Rewatches;
  s11WordsLists: S11WordsTagsLists;
  s12Watchlist: S12Watchlist;
  s13Records: S13Records;
}
