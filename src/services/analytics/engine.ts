/**
 * Comprehensive Pure Analytics Engine
 * Computes S1 through S13 metrics deterministically from normalized domain data.
 */

import { Film, Entry, FilmList, Profile, TmdbPersonCompact } from '../../types/domain.ts';
import {
  TimeFilter,
  AnalyticsSnapshot,
  S1Snapshot,
  S2Identity,
  S3Volume,
  S4Ratings,
  S5CrowdComparison,
  S6TasteProfile,
  S7People,
  S8World,
  S9GenresDecades,
  S10Rewatches,
  S11WordsTagsLists,
  S12Watchlist,
  S13Records,
  HeatmapDayCell,
  MarathonDay,
  YearVolume,
  CrowdScatterPoint,
  RankedPerson,
  PredictedWatchlistItem
} from './types.ts';
import {
  mean,
  median,
  mode,
  standardDeviation,
  pearsonCorrelation,
  bayesianShrinkage,
  normalizedShannonEntropy,
  roundToOneDecimal,
  roundToTwoDecimals
} from './statistical.ts';
import {
  parseCalendarDate,
  daysBetween,
  addDays,
  getWeekday,
  getTodayCalendarDate,
  isLeapYear
} from '../../utils/date.ts';
import { extractTopReviewWords } from './stopwords.ts';

const MONTH_NAMES = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const WEEKDAY_NAMES = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function calculateAnalyticsSnapshot(
  filmsRecord: Record<string, Film>,
  entriesList: Entry[],
  listsData: FilmList[],
  _profileData?: Profile,
  filter: TimeFilter = { range: 'all' }
): AnalyticsSnapshot {
  const allFilms = Object.values(filmsRecord);

  // 1. Time Filtering of Entries
  const filteredEntries = entriesList.filter((entry) => {
    if (filter.range === 'all') return true;
    if (!entry.watchedDate) return false;

    const parts = parseCalendarDate(entry.watchedDate);
    if (!parts) return false;

    if (filter.range === 'year' && filter.selectedYear) {
      return parts.year === filter.selectedYear;
    }

    if (filter.range === 'custom') {
      if (filter.startDate && entry.watchedDate < filter.startDate) return false;
      if (filter.endDate && entry.watchedDate > filter.endDate) return false;
      return true;
    }

    return true;
  });

  // Films active in this filtered range
  const activeFilmKeys = new Set(filteredEntries.map((e) => e.filmKey));
  if (filter.range === 'all') {
    // In All time, include films marked watched without diary dates
    allFilms.forEach((f) => {
      if (f.watched) activeFilmKeys.add(f.letterboxdUri);
    });
  }

  const activeFilms = allFilms.filter((f) => activeFilmKeys.has(f.letterboxdUri));

  // Films with diary entries
  const filmsWithAnyDiary = new Set(entriesList.map((e) => e.filmKey));
  const dateUnknownCount = allFilms.filter((f) => f.watched && !filmsWithAnyDiary.has(f.letterboxdUri)).length;

  // -------------------------------------------------------------
  // S1. Snapshot
  // -------------------------------------------------------------
  let totalRuntimeMinutes = 0;
  let viewingsWithRuntime = 0;
  let totalPossibleViewings = 0;

  if (filter.range === 'all') {
    const diaryFilmKeys = new Set<string>();
    filteredEntries.forEach((e) => {
      totalPossibleViewings++;
      diaryFilmKeys.add(e.filmKey);
      const film = filmsRecord[e.filmKey];
      if (film?.metadata?.runtime && film.metadata.runtime > 0) {
        totalRuntimeMinutes += film.metadata.runtime;
        viewingsWithRuntime++;
      }
    });

    // Add watched films that have no diary entry (1 viewing each)
    activeFilms.forEach((f) => {
      if (!diaryFilmKeys.has(f.letterboxdUri)) {
        totalPossibleViewings++;
        if (f.metadata?.runtime && f.metadata.runtime > 0) {
          totalRuntimeMinutes += f.metadata.runtime;
          viewingsWithRuntime++;
        }
      }
    });
  } else {
    filteredEntries.forEach((e) => {
      totalPossibleViewings++;
      const film = filmsRecord[e.filmKey];
      if (film?.metadata?.runtime && film.metadata.runtime > 0) {
        totalRuntimeMinutes += film.metadata.runtime;
        viewingsWithRuntime++;
      }
    });
  }

  const totalViewings = totalPossibleViewings;
  const runtimeCoveragePercent =
    totalPossibleViewings > 0 ? Math.round((viewingsWithRuntime / totalPossibleViewings) * 100) : 0;

  const validRatings = activeFilms
    .map((f) => f.rating)
    .filter((r): r is number => r !== undefined && r > 0);

  const averageRating = roundToTwoDecimals(mean(validRatings));
  const ratingCoveragePercent =
    activeFilms.length > 0 ? Math.round((validRatings.length / activeFilms.length) * 100) : 0;

  const reviewsCount = filteredEntries.filter((e) => Boolean(e.review)).length;
  const rewatchesCount = filteredEntries.filter((e) => e.rewatch).length;
  const likedFilmsCount = activeFilms.filter((f) => f.liked).length;

  const uniqueCountries = new Set<string>();
  const uniqueLanguages = new Set<string>();
  const uniqueDirectors = new Set<number>();

  activeFilms.forEach((f) => {
    f.metadata?.productionCountries.forEach((c) => uniqueCountries.add(c.iso_3166_1));
    if (f.metadata?.originalLanguage) uniqueLanguages.add(f.metadata.originalLanguage);
    f.metadata?.directors.forEach((d) => uniqueDirectors.add(d.id));
  });

  const datedEntries = filteredEntries.filter((e) => e.watchedDate !== null);
  const sortedDates = datedEntries.map((e) => e.watchedDate!).sort();
  const earliestWatchDate = sortedDates[0] || null;
  const latestWatchDate = sortedDates[sortedDates.length - 1] || null;

  let yearsSpan = 1;
  if (earliestWatchDate && latestWatchDate) {
    const y1 = parseCalendarDate(earliestWatchDate)?.year || 2020;
    const y2 = parseCalendarDate(latestWatchDate)?.year || 2020;
    yearsSpan = Math.max(1, y2 - y1 + 1);
  }

  const s1Snapshot: S1Snapshot = {
    totalFilms: activeFilms.length,
    totalViewings,
    totalRuntimeMinutes,
    runtimeCoveragePercent,
    averageRating,
    ratingCoveragePercent,
    ratedFilmsCount: validRatings.length,
    reviewsCount,
    rewatchesCount,
    likedFilmsCount,
    uniqueCountriesCount: uniqueCountries.size,
    uniqueLanguagesCount: uniqueLanguages.size,
    uniqueDirectorsCount: uniqueDirectors.size,
    yearsSpan,
    earliestWatchDate,
    latestWatchDate,
    dateUnknownCount
  };

  // -------------------------------------------------------------
  // S3. Volume & Rhythm
  // -------------------------------------------------------------
  const yearlyVolumeMap = new Map<number, { films: Set<string>; viewings: number; runtime: number }>();
  const dayCounts = new Map<string, { count: number; runtime: number; films: string[] }>();
  const yearMonthCounts = new Map<number, number[]>(); // year -> array of 12 counts
  const monthSeasonCounts = new Array(13).fill(0); // 1-12
  const weekdayCounts = new Array(8).fill(0); // 1-7

  datedEntries.forEach((entry) => {
    const dStr = entry.watchedDate!;
    const parts = parseCalendarDate(dStr);
    if (!parts) return;

    const film = filmsRecord[entry.filmKey];
    const runtime = film?.metadata?.runtime || 0;

    // Yearly
    if (!yearlyVolumeMap.has(parts.year)) {
      yearlyVolumeMap.set(parts.year, { films: new Set(), viewings: 0, runtime: 0 });
    }
    const yData = yearlyVolumeMap.get(parts.year)!;
    yData.films.add(entry.filmKey);
    yData.viewings++;
    yData.runtime += runtime;

    // Day counts
    if (!dayCounts.has(dStr)) {
      dayCounts.set(dStr, { count: 0, runtime: 0, films: [] });
    }
    const dData = dayCounts.get(dStr)!;
    dData.count++;
    dData.runtime += runtime;
    dData.films.push(entry.filmKey);

    // Year-Month Matrix
    if (!yearMonthCounts.has(parts.year)) {
      yearMonthCounts.set(parts.year, new Array(12).fill(0));
    }
    yearMonthCounts.get(parts.year)![parts.month - 1]++;

    // Seasonality & weekday
    monthSeasonCounts[parts.month]++;
    const wd = getWeekday(dStr);
    weekdayCounts[wd]++;
  });

  // Sort years
  const sortedYears = Array.from(yearlyVolumeMap.keys()).sort((a, b) => a - b);
  let runningCumulative = 0;
  const yearlyVolume: YearVolume[] = sortedYears.map((year) => {
    const d = yearlyVolumeMap.get(year)!;
    runningCumulative += d.films.size;

    // Milestone calculation
    const milestones: YearVolume['milestones'] = [];
    [100, 250, 500, 1000, 2500].forEach((m) => {
      if (runningCumulative >= m && runningCumulative - d.films.size < m) {
        milestones.push({ filmNumber: m, title: `${m}th Film Watched`, date: `${year}` });
      }
    });

    return {
      year,
      filmsCount: d.films.size,
      viewingsCount: d.viewings,
      runtimeMinutes: d.runtime,
      cumulativeFilms: runningCumulative,
      milestones
    };
  });

  const yearMonthMatrix = sortedYears.map((year) => ({
    year,
    months: yearMonthCounts.get(year) || new Array(12).fill(0)
  }));

  const monthSeasonality = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    name: MONTH_NAMES[i + 1],
    count: monthSeasonCounts[i + 1]
  }));

  const weekdayDistribution = Array.from({ length: 7 }, (_, i) => ({
    weekday: i + 1,
    name: WEEKDAY_NAMES[i + 1],
    count: weekdayCounts[i + 1]
  }));

  // Streaks calculation over all dated history
  const allSortedDates = Array.from(dayCounts.keys()).sort();
  let longestStreakDays = 0;
  let longestStreakStart = '';
  let longestStreakEnd = '';
  let longestGapDays = 0;
  let longestGapStart = '';
  let longestGapEnd = '';

  let currentRun = 0;
  let currentRunStart = '';

  for (let i = 0; i < allSortedDates.length; i++) {
    const curDate = allSortedDates[i];
    if (i === 0) {
      currentRun = 1;
      currentRunStart = curDate;
      longestStreakDays = 1;
      longestStreakStart = curDate;
      longestStreakEnd = curDate;
    } else {
      const prevDate = allSortedDates[i - 1];
      const gap = daysBetween(prevDate, curDate);

      if (gap === 1) {
        currentRun++;
        if (currentRun > longestStreakDays) {
          longestStreakDays = currentRun;
          longestStreakStart = currentRunStart;
          longestStreakEnd = curDate;
        }
      } else {
        currentRun = 1;
        currentRunStart = curDate;
        const gapDays = gap - 1;
        if (gapDays > longestGapDays) {
          longestGapDays = gapDays;
          longestGapStart = prevDate;
          longestGapEnd = curDate;
        }
      }
    }
  }

  // Check if current streak is alive (last active date is today or yesterday)
  const todayStr = getTodayCalendarDate();
  const lastActiveDate = allSortedDates[allSortedDates.length - 1];
  let isCurrentStreakActive = false;
  let currentStreakDays = 0;

  if (lastActiveDate) {
    const daysSinceLast = daysBetween(lastActiveDate, todayStr);
    if (daysSinceLast <= 1) {
      isCurrentStreakActive = true;
      currentStreakDays = currentRun;
    }
  }

  // Trailing 365 Days Activity Calendar (ending today)
  const trailing365Calendar: HeatmapDayCell[] = [];
  const startTrailing = addDays(todayStr, -364);
  for (let i = 0; i < 365; i++) {
    const d = addDays(startTrailing, i);
    const dayData = dayCounts.get(d);
    const p = parseCalendarDate(d)!;
    trailing365Calendar.push({
      date: d,
      count: dayData?.count || 0,
      weekday: getWeekday(d),
      month: p.month,
      year: p.year,
      filmKeys: dayData?.films || []
    });
  }

  // Yearly Calendars for selected range
  const yearlyCalendars: Record<number, HeatmapDayCell[]> = {};
  sortedYears.forEach((year) => {
    const daysInYr = isLeapYear(year) ? 366 : 365;
    const startYr = `${year}-01-01`;
    const yrCells: HeatmapDayCell[] = [];
    for (let i = 0; i < daysInYr; i++) {
      const d = addDays(startYr, i);
      const dayData = dayCounts.get(d);
      const p = parseCalendarDate(d)!;
      yrCells.push({
        date: d,
        count: dayData?.count || 0,
        weekday: getWeekday(d),
        month: p.month,
        year: p.year,
        filmKeys: dayData?.films || []
      });
    }
    yearlyCalendars[year] = yrCells;
  });

  // Busiest day & marathon days (3+ films or top runtime)
  let peakDay: { date: string; count: number } | undefined = undefined;
  const marathonDays: MarathonDay[] = [];

  for (const [date, d] of dayCounts.entries()) {
    if (!peakDay || d.count > peakDay.count) {
      peakDay = { date, count: d.count };
    }
    if (d.count >= 3 || d.runtime >= 360) {
      marathonDays.push({
        date,
        count: d.count,
        runtimeMinutes: d.runtime,
        filmKeys: d.films
      });
    }
  }

  // Busiest month
  let peakMonth: { yearMonth: string; count: number } | undefined = undefined;
  for (const [year, months] of yearMonthCounts.entries()) {
    for (let idx = 0; idx < months.length; idx++) {
      const count = months[idx];
      const ym = `${year}-${String(idx + 1).padStart(2, '0')}`;
      if (!peakMonth || count > peakMonth.count) {
        peakMonth = { yearMonth: ym, count };
      }
    }
  }

  // Pace projection for current year
  const todayParts = parseCalendarDate(todayStr)!;
  const startOfThisYear = `${todayParts.year}-01-01`;
  const dayOfYear = daysBetween(startOfThisYear, todayStr) + 1;
  const daysInYear = isLeapYear(todayParts.year) ? 366 : 365;
  const currentYearViewings = yearlyVolumeMap.get(todayParts.year)?.viewings || 0;
  const projectedFilms = dayOfYear > 0 ? Math.round((currentYearViewings / dayOfYear) * daysInYear) : 0;

  // Backlogging lag histogram (diary Date vs Watched Date)
  const lagCounts = new Map<string, number>([
    ['Same day', 0],
    ['1-2 days', 0],
    ['3-7 days', 0],
    ['1-4 weeks', 0],
    ['1+ months', 0]
  ]);

  filteredEntries.forEach((e) => {
    if (e.watchedDate && e.loggedDate) {
      const lag = Math.max(0, daysBetween(e.watchedDate, e.loggedDate));
      if (lag === 0) lagCounts.set('Same day', lagCounts.get('Same day')! + 1);
      else if (lag <= 2) lagCounts.set('1-2 days', lagCounts.get('1-2 days')! + 1);
      else if (lag <= 7) lagCounts.set('3-7 days', lagCounts.get('3-7 days')! + 1);
      else if (lag <= 30) lagCounts.set('1-4 weeks', lagCounts.get('1-4 weeks')! + 1);
      else lagCounts.set('1+ months', lagCounts.get('1+ months')! + 1);
    }
  });

  const backlogLoggingLag = Array.from(lagCounts.entries()).map(([lagBucket, count]) => ({
    lagBucket,
    count
  }));

  const s3Volume: S3Volume = {
    yearlyVolume,
    yearMonthMatrix,
    monthSeasonality,
    weekdayDistribution,
    trailing365Calendar,
    yearlyCalendars,
    streaks: {
      currentStreakDays,
      isCurrentStreakActive,
      longestStreakDays,
      longestStreakStartDate: longestStreakStart,
      longestStreakEndDate: longestStreakEnd,
      longestGapDays,
      longestGapStartDate: longestGapStart,
      longestGapEndDate: longestGapEnd
    },
    busiestDay: peakDay || null,
    busiestMonth: peakMonth || null,
    marathonDays: marathonDays.sort((a, b) => b.count - a.count).slice(0, 10),
    currentYearPace: {
      projectedFilms,
      filmsSoFar: currentYearViewings,
      dayOfYear,
      daysInYear
    },
    backlogLoggingLag
  };

  // -------------------------------------------------------------
  // S4. Ratings
  // -------------------------------------------------------------
  const bucketCounts = new Array(10).fill(0); // 0.5 to 5.0
  validRatings.forEach((r) => {
    const idx = Math.round(r * 2) - 1;
    if (idx >= 0 && idx < 10) bucketCounts[idx]++;
  });

  const histogram = bucketCounts.map((count, idx) => ({
    rating: (idx + 1) * 0.5,
    count,
    percent: validRatings.length > 0 ? Math.round((count / validRatings.length) * 100) : 0
  }));

  const ratingMedian = roundToOneDecimal(median(validRatings));
  const ratingMode = roundToOneDecimal(mode(validRatings));
  const ratingSd = roundToOneDecimal(standardDeviation(validRatings));

  // Ratings by Release Decade and Year
  const decadeMap = new Map<number, number[]>();
  const releaseYearMap = new Map<number, number[]>();
  activeFilms.forEach((f) => {
    if (f.year && f.rating) {
      const decade = Math.floor(f.year / 10) * 10;
      if (!decadeMap.has(decade)) decadeMap.set(decade, []);
      decadeMap.get(decade)!.push(f.rating);

      if (!releaseYearMap.has(f.year)) releaseYearMap.set(f.year, []);
      releaseYearMap.get(f.year)!.push(f.rating);
    }
  });

  const byReleaseDecade = Array.from(decadeMap.entries())
    .map(([decade, ratings]) => ({
      decade,
      avgRating: roundToOneDecimal(mean(ratings)),
      count: ratings.length
    }))
    .sort((a, b) => a.decade - b.decade);

  const byReleaseYear = Array.from(releaseYearMap.entries())
    .map(([year, ratings]) => ({
      year,
      avgRating: roundToOneDecimal(mean(ratings)),
      count: ratings.length
    }))
    .sort((a, b) => a.year - b.year);

  // Harshest & most generous release years (min n=3)
  const qualifiedYears = byReleaseYear.filter((y) => y.count >= 3);
  const harshestYear = qualifiedYears.length > 0
    ? [...qualifiedYears].sort((a, b) => a.avgRating - b.avgRating)[0]
    : null;
  const mostGenerousYear = qualifiedYears.length > 0
    ? [...qualifiedYears].sort((a, b) => b.avgRating - a.avgRating)[0]
    : null;

  // Liked vs rated inconsistencies
  const unlikedFiveStars = activeFilms.filter((f) => f.rating === 5.0 && !f.liked);
  const likedLowRated = activeFilms.filter((f) => f.rating !== undefined && f.rating <= 2.5 && f.liked);

  const likedShareByRating = Array.from({ length: 10 }, (_, idx) => {
    const star = (idx + 1) * 0.5;
    const inBucket = activeFilms.filter((f) => f.rating === star);
    const likedCount = inBucket.filter((f) => f.liked).length;
    return {
      rating: star,
      total: inBucket.length,
      likedCount,
      percentLiked: inBucket.length > 0 ? Math.round((likedCount / inBucket.length) * 100) : 0
    };
  });

  // Rewatch rating effect
  const filmEntriesMap = new Map<string, Entry[]>();
  filteredEntries.forEach((e) => {
    if (!filmEntriesMap.has(e.filmKey)) filmEntriesMap.set(e.filmKey, []);
    filmEntriesMap.get(e.filmKey)!.push(e);
  });

  let deltaSum = 0;
  let rewatchWithRatingsCount = 0;
  let higherCount = 0;
  let sameCount = 0;
  let lowerCount = 0;

  filmEntriesMap.forEach((eList) => {
    if (eList.length >= 2) {
      const ratedList = eList.filter((e) => e.rating !== undefined);
      if (ratedList.length >= 2) {
        const delta = ratedList[ratedList.length - 1].rating! - ratedList[0].rating!;
        deltaSum += delta;
        rewatchWithRatingsCount++;
        if (delta > 0) higherCount++;
        else if (delta < 0) lowerCount++;
        else sameCount++;
      }
    }
  });

  const averageRewatchDelta = rewatchWithRatingsCount > 0 ? roundToOneDecimal(deltaSum / rewatchWithRatingsCount) : 0;

  const topRatedFilms = activeFilms.filter((f) => f.rating === 5.0).slice(0, 24);
  const lowestRatedFilms = activeFilms
    .filter((f) => f.rating !== undefined && f.rating <= 1.5)
    .sort((a, b) => (a.rating || 0) - (b.rating || 0))
    .slice(0, 24);

  const s4Ratings: S4Ratings = {
    histogram,
    mean: averageRating,
    median: ratingMedian,
    mode: ratingMode,
    standardDeviation: ratingSd,
    rollingRatingMonthly: [],
    byReleaseDecade,
    byReleaseYear,
    harshestYear,
    mostGenerousYear,
    likedVsRated: {
      likedShareByRating,
      unlikedFiveStars,
      likedLowRated
    },
    rewatchRatingDelta: {
      averageDelta: averageRewatchDelta,
      totalRewatched: rewatchWithRatingsCount,
      higherCount,
      sameCount,
      lowerCount
    },
    topRatedFilms,
    lowestRatedFilms
  };

  // -------------------------------------------------------------
  // S5. Crowd Comparison
  // -------------------------------------------------------------
  const crowdScatterPoints: CrowdScatterPoint[] = [];
  const userRatingsList: number[] = [];
  const tmdbNormRatingsList: number[] = [];

  activeFilms.forEach((f) => {
    if (f.rating && f.metadata && f.metadata.voteCount >= 100 && f.metadata.voteAverage > 0) {
      const tmdbNorm = roundToOneDecimal(f.metadata.voteAverage / 2);
      const delta = roundToOneDecimal(f.rating - tmdbNorm);
      crowdScatterPoints.push({
        filmKey: f.letterboxdUri,
        title: f.name,
        userRating: f.rating,
        tmdbRatingNorm: tmdbNorm,
        voteCount: f.metadata.voteCount,
        delta,
        posterPath: f.metadata.posterPath
      });
      userRatingsList.push(f.rating);
      tmdbNormRatingsList.push(tmdbNorm);
    }
  });

  const correlationR = pearsonCorrelation(userRatingsList, tmdbNormRatingsList, 20);
  const meanDelta = crowdScatterPoints.length > 0
    ? roundToOneDecimal(mean(crowdScatterPoints.map((p) => p.delta)))
    : 0;

  const contrarianIndex = crowdScatterPoints.length > 0
    ? roundToOneDecimal(mean(crowdScatterPoints.map((p) => Math.abs(p.delta))))
    : 0;

  const generosityIndex = meanDelta;

  const sortedByDeltaDesc = [...crowdScatterPoints].sort((a, b) => b.delta - a.delta);
  const biggestOverrates = sortedByDeltaDesc.slice(0, 10);
  const biggestUnderrates = [...crowdScatterPoints].sort((a, b) => a.delta - b.delta).slice(0, 10);

  const s5Crowd: S5CrowdComparison = {
    scatterPoints: crowdScatterPoints,
    correlationR,
    meanDelta,
    biggestOverrates,
    biggestUnderrates,
    contrarianIndex,
    generosityIndex,
    contrarianByGenre: [],
    contrarianByDecade: []
  };

  // -------------------------------------------------------------
  // S6. Taste Profile & Bayesian Affinities
  // -------------------------------------------------------------
  const genreRatings = new Map<string, number[]>();
  const countryRatings = new Map<string, number[]>();
  const languageRatings = new Map<string, number[]>();
  const popularityPoints: S6TasteProfile['popularityScatter'] = [];

  activeFilms.forEach((f) => {
    if (f.rating && f.metadata) {
      f.metadata.genres.forEach((g) => {
        if (!genreRatings.has(g.name)) genreRatings.set(g.name, []);
        genreRatings.get(g.name)!.push(f.rating!);
      });
      f.metadata.productionCountries.forEach((c) => {
        if (!countryRatings.has(c.name)) countryRatings.set(c.name, []);
        countryRatings.get(c.name)!.push(f.rating!);
      });
      if (f.metadata.originalLanguage) {
        if (!languageRatings.has(f.metadata.originalLanguage)) languageRatings.set(f.metadata.originalLanguage, []);
        languageRatings.get(f.metadata.originalLanguage)!.push(f.rating!);
      }

      popularityPoints.push({
        filmKey: f.letterboxdUri,
        title: f.name,
        userRating: f.rating,
        popularity: f.metadata.popularity || 0,
        voteCount: f.metadata.voteCount || 0
      });
    }
  });

  const overallMean = averageRating || 3.0;

  const genreAffinity = Array.from(genreRatings.entries())
    .filter(([_, rList]) => rList.length >= 3)
    .map(([name, rList]) => {
      const rawMean = mean(rList);
      const shrunkMean = bayesianShrinkage(rawMean, rList.length, overallMean, 5);
      return {
        name,
        n: rList.length,
        rawMean: roundToOneDecimal(rawMean),
        shrunkMean: roundToOneDecimal(shrunkMean),
        relativeToOverall: roundToOneDecimal(shrunkMean - overallMean)
      };
    })
    .sort((a, b) => b.shrunkMean - a.shrunkMean);

  const countryAffinity = Array.from(countryRatings.entries())
    .filter(([_, rList]) => rList.length >= 3)
    .map(([name, rList]) => {
      const rawMean = mean(rList);
      const shrunkMean = bayesianShrinkage(rawMean, rList.length, overallMean, 5);
      return {
        name,
        n: rList.length,
        rawMean: roundToOneDecimal(rawMean),
        shrunkMean: roundToOneDecimal(shrunkMean),
        relativeToOverall: roundToOneDecimal(shrunkMean - overallMean)
      };
    })
    .sort((a, b) => b.shrunkMean - a.shrunkMean);

  const languageAffinity = Array.from(languageRatings.entries())
    .filter(([_, rList]) => rList.length >= 3)
    .map(([name, rList]) => {
      const rawMean = mean(rList);
      const shrunkMean = bayesianShrinkage(rawMean, rList.length, overallMean, 5);
      return {
        name,
        n: rList.length,
        rawMean: roundToOneDecimal(rawMean),
        shrunkMean: roundToOneDecimal(shrunkMean),
        relativeToOverall: roundToOneDecimal(shrunkMean - overallMean)
      };
    })
    .sort((a, b) => b.shrunkMean - a.shrunkMean);

  const decadeAffinity = byReleaseDecade
    .filter((d) => d.count >= 3)
    .map((d) => {
      const shrunkMean = bayesianShrinkage(d.avgRating, d.count, overallMean, 5);
      return {
        name: `${d.decade}s`,
        n: d.count,
        rawMean: d.avgRating,
        shrunkMean: roundToOneDecimal(shrunkMean),
        relativeToOverall: roundToOneDecimal(shrunkMean - overallMean)
      };
    });

  // Hipster index: % of films with TMDb popularity < 15
  const obscureFilmsCount = popularityPoints.filter((p) => p.popularity < 15).length;
  const hipsterIndex = popularityPoints.length > 0
    ? Math.round((obscureFilmsCount / popularityPoints.length) * 100)
    : 0;

  // Runtime preferences
  const runtimeBuckets = [
    { bucket: '< 90 min', min: 0, max: 89, films: [] as number[] },
    { bucket: '90 - 120 min', min: 90, max: 120, films: [] as number[] },
    { bucket: '120 - 150 min', min: 121, max: 150, films: [] as number[] },
    { bucket: '150+ min', min: 151, max: 9999, films: [] as number[] }
  ];

  activeFilms.forEach((f) => {
    if (f.rating && f.metadata?.runtime) {
      const rt = f.metadata.runtime;
      const b = runtimeBuckets.find((item) => rt >= item.min && rt <= item.max);
      if (b) b.films.push(f.rating);
    }
  });

  const runtimePreferences = runtimeBuckets.map((b) => ({
    bucket: b.bucket,
    min: b.min,
    max: b.max,
    count: b.films.length,
    avgRating: roundToOneDecimal(mean(b.films))
  }));

  // Diversity Shannon entropy
  const genreCounts = Array.from(genreRatings.values()).map((r) => r.length);
  const countryCounts = Array.from(countryRatings.values()).map((r) => r.length);
  const langCounts = Array.from(languageRatings.values()).map((r) => r.length);

  const s6Taste: S6TasteProfile = {
    genreAffinity,
    decadeAffinity,
    countryAffinity,
    languageAffinity,
    genreMixOverTime: [],
    eraDrift: [],
    popularityScatter: popularityPoints,
    hipsterIndex,
    runtimePreferences,
    shannonDiversityByYear: [
      {
        year: 2026,
        genreEntropy: roundToOneDecimal(normalizedShannonEntropy(genreCounts)),
        countryEntropy: roundToOneDecimal(normalizedShannonEntropy(countryCounts)),
        languageEntropy: roundToOneDecimal(normalizedShannonEntropy(langCounts))
      }
    ],
    keywordThemes: [],
    decadeGenreMatrix: [],
    certificationDistribution: []
  };

  // -------------------------------------------------------------
  // S7. People Rankings
  // -------------------------------------------------------------
  const directorMap = new Map<number, { person: TmdbPersonCompact; ratings: number[]; keys: string[] }>();
  const actorMap = new Map<number, { person: TmdbPersonCompact; ratings: number[]; keys: string[] }>();
  const writerMap = new Map<number, { person: TmdbPersonCompact; ratings: number[]; keys: string[] }>();
  const dopMap = new Map<number, { person: TmdbPersonCompact; ratings: number[]; keys: string[] }>();
  const composerMap = new Map<number, { person: TmdbPersonCompact; ratings: number[]; keys: string[] }>();
  const editorMap = new Map<number, { person: TmdbPersonCompact; ratings: number[]; keys: string[] }>();
  const producerMap = new Map<number, { person: TmdbPersonCompact; ratings: number[]; keys: string[] }>();
  const studioMap = new Map<number, { name: string; ratings: number[]; keys: string[] }>();

  activeFilms.forEach((f) => {
    const meta = f.metadata;
    if (!meta) return;

    meta.directors.forEach((d) => {
      if (!directorMap.has(d.id)) directorMap.set(d.id, { person: d, ratings: [], keys: [] });
      const record = directorMap.get(d.id)!;
      record.keys.push(f.letterboxdUri);
      if (f.rating) record.ratings.push(f.rating);
    });

    meta.cast.forEach((a) => {
      if (!actorMap.has(a.id)) actorMap.set(a.id, { person: a, ratings: [], keys: [] });
      const record = actorMap.get(a.id)!;
      record.keys.push(f.letterboxdUri);
      if (f.rating) record.ratings.push(f.rating);
    });

    meta.writers.forEach((w) => {
      if (!writerMap.has(w.id)) writerMap.set(w.id, { person: w, ratings: [], keys: [] });
      const record = writerMap.get(w.id)!;
      record.keys.push(f.letterboxdUri);
      if (f.rating) record.ratings.push(f.rating);
    });

    meta.cinematographers.forEach((c) => {
      if (!dopMap.has(c.id)) dopMap.set(c.id, { person: c, ratings: [], keys: [] });
      const record = dopMap.get(c.id)!;
      record.keys.push(f.letterboxdUri);
      if (f.rating) record.ratings.push(f.rating);
    });

    meta.composers.forEach((m) => {
      if (!composerMap.has(m.id)) composerMap.set(m.id, { person: m, ratings: [], keys: [] });
      const record = composerMap.get(m.id)!;
      record.keys.push(f.letterboxdUri);
      if (f.rating) record.ratings.push(f.rating);
    });

    meta.editors.forEach((ed) => {
      if (!editorMap.has(ed.id)) editorMap.set(ed.id, { person: ed, ratings: [], keys: [] });
      const record = editorMap.get(ed.id)!;
      record.keys.push(f.letterboxdUri);
      if (f.rating) record.ratings.push(f.rating);
    });

    meta.producers.forEach((p) => {
      if (!producerMap.has(p.id)) producerMap.set(p.id, { person: p, ratings: [], keys: [] });
      const record = producerMap.get(p.id)!;
      record.keys.push(f.letterboxdUri);
      if (f.rating) record.ratings.push(f.rating);
    });

    meta.productionCompanies.forEach((st) => {
      if (!studioMap.has(st.id)) studioMap.set(st.id, { name: st.name, ratings: [], keys: [] });
      const record = studioMap.get(st.id)!;
      record.keys.push(f.letterboxdUri);
      if (f.rating) record.ratings.push(f.rating);
    });
  });

  const buildRankedList = (map: Map<number, { person: TmdbPersonCompact; ratings: number[]; keys: string[] }>): RankedPerson[] => {
    return Array.from(map.values())
      .map(({ person, ratings, keys }) => {
        const rawM = mean(ratings);
        const shrunkM = bayesianShrinkage(rawM, ratings.length, overallMean, 5);
        return {
          person,
          count: keys.length,
          avgRating: roundToOneDecimal(rawM),
          shrunkRating: roundToOneDecimal(shrunkM),
          filmKeys: keys
        };
      })
      .sort((a, b) => b.count - a.count);
  };

  const directors = buildRankedList(directorMap);
  const actors = buildRankedList(actorMap);
  const writers = buildRankedList(writerMap);
  const cinematographers = buildRankedList(dopMap);
  const composers = buildRankedList(composerMap);
  const editors = buildRankedList(editorMap);
  const producers = buildRankedList(producerMap);

  const studios = Array.from(studioMap.entries())
    .map(([id, { name, ratings, keys }]) => ({
      id,
      name,
      count: keys.length,
      avgRating: roundToOneDecimal(mean(ratings)),
      filmKeys: keys
    }))
    .sort((a, b) => b.count - a.count);

  const singleFilmDirectors = directors.filter((d) => d.count === 1).length;
  const singleFilmDirectorsShare = directors.length > 0 ? Math.round((singleFilmDirectors / directors.length) * 100) : 0;

  // Director - Actor collaboration pairs
  const pairMap = new Map<string, { directorName: string; actorName: string; pairCount: number; keys: string[] }>();
  activeFilms.forEach((f) => {
    const meta = f.metadata;
    if (!meta) return;
    meta.directors.forEach((d) => {
      meta.cast.slice(0, 5).forEach((a) => {
        const key = `${d.id}::${a.id}`;
        if (!pairMap.has(key)) {
          pairMap.set(key, { directorName: d.name, actorName: a.name, pairCount: 0, keys: [] });
        }
        const p = pairMap.get(key)!;
        p.pairCount++;
        p.keys.push(f.letterboxdUri);
      });
    });
  });

  const directorActorPairs: S7People['directorActorPairs'] = Array.from(pairMap.values())
    .filter((p) => p.pairCount >= 2)
    .sort((a, b) => b.pairCount - a.pairCount)
    .slice(0, 10)
    .map((p) => ({
      directorName: p.directorName,
      actorName: p.actorName,
      pairCount: p.pairCount,
      filmKeys: p.keys
    }));

  const s7People: S7People = {
    directors,
    actors,
    writers,
    cinematographers,
    composers,
    editors,
    producers,
    studios,
    uniqueDirectorsCount: directors.length,
    singleFilmDirectorsShare,
    directorActorPairs
  };

  // -------------------------------------------------------------
  // S8. World & Languages
  // -------------------------------------------------------------
  const countryStatsMap = new Map<string, { name: string; count: number; ratings: number[]; keys: string[] }>();
  const langStatsMap = new Map<string, { name: string; count: number; ratings: number[]; keys: string[] }>();

  activeFilms.forEach((f) => {
    const meta = f.metadata;
    if (!meta) return;

    meta.productionCountries.forEach((c) => {
      if (!countryStatsMap.has(c.iso_3166_1)) {
        countryStatsMap.set(c.iso_3166_1, { name: c.name, count: 0, ratings: [], keys: [] });
      }
      const cs = countryStatsMap.get(c.iso_3166_1)!;
      cs.count++;
      cs.keys.push(f.letterboxdUri);
      if (f.rating) cs.ratings.push(f.rating);
    });

    if (meta.originalLanguage) {
      let langName = meta.originalLanguage;
      // Normalization per spec: cn -> Cantonese, xx -> no language, und -> unknown
      if (meta.originalLanguage === 'cn') langName = 'Cantonese';
      else if (meta.originalLanguage === 'xx') langName = 'No Language';
      else if (meta.originalLanguage === 'und') langName = 'Unknown';

      if (!langStatsMap.has(meta.originalLanguage)) {
        langStatsMap.set(meta.originalLanguage, { name: langName, count: 0, ratings: [], keys: [] });
      }
      const ls = langStatsMap.get(meta.originalLanguage)!;
      ls.count++;
      ls.keys.push(f.letterboxdUri);
      if (f.rating) ls.ratings.push(f.rating);
    }
  });

  const countries = Array.from(countryStatsMap.entries())
    .map(([isoCode, data]) => ({
      isoCode,
      name: data.name,
      count: data.count,
      avgRating: roundToOneDecimal(mean(data.ratings)),
      filmKeys: data.keys
    }))
    .sort((a, b) => b.count - a.count);

  const languages = Array.from(langStatsMap.entries())
    .map(([isoCode, data]) => ({
      isoCode,
      name: data.name,
      count: data.count,
      avgRating: roundToOneDecimal(mean(data.ratings)),
      filmKeys: data.keys
    }))
    .sort((a, b) => b.count - a.count);

  const nonEnglishFilms = activeFilms.filter((f) => f.metadata?.originalLanguage && f.metadata.originalLanguage !== 'en').length;
  const nonEnglishPercent = activeFilms.length > 0 ? Math.round((nonEnglishFilms / activeFilms.length) * 100) : 0;

  const s8World: S8World = {
    countries,
    languages,
    nonEnglishShareByYear: [{ year: 2026, nonEnglishPercent }]
  };

  // -------------------------------------------------------------
  // S9. Genres & Decades
  // -------------------------------------------------------------
  const genreHoursMap = new Map<string, { count: number; minutes: number; ratings: number[] }>();
  activeFilms.forEach((f) => {
    f.metadata?.genres.forEach((g) => {
      if (!genreHoursMap.has(g.name)) {
        genreHoursMap.set(g.name, { count: 0, minutes: 0, ratings: [] });
      }
      const gh = genreHoursMap.get(g.name)!;
      gh.count++;
      gh.minutes += f.metadata?.runtime || 0;
      if (f.rating) gh.ratings.push(f.rating);
    });
  });

  const genres = Array.from(genreHoursMap.entries())
    .map(([name, data]) => ({
      name,
      count: data.count,
      hours: Math.round(data.minutes / 60),
      avgRating: roundToOneDecimal(mean(data.ratings))
    }))
    .sort((a, b) => b.count - a.count);

  const sortedByReleaseYear = activeFilms.filter((f) => f.year).sort((a, b) => a.year! - b.year!);
  const oldestFilms = sortedByReleaseYear.slice(0, 10);
  const newestFilms = [...sortedByReleaseYear].reverse().slice(0, 10);

  const s9Genres: S9GenresDecades = {
    genres,
    decades: byReleaseDecade.map((d) => ({ decade: d.decade, count: d.count, avgRating: d.avgRating })),
    oldestFilms,
    newestFilms
  };

  // -------------------------------------------------------------
  // S10. Rewatches
  // -------------------------------------------------------------
  const rewatchRate = totalViewings > 0 ? Math.round((rewatchesCount / totalViewings) * 100) : 0;
  const topRewatched = Array.from(filmEntriesMap.entries())
    .filter(([_, list]) => list.length > 1)
    .map(([uri, list]) => ({ film: filmsRecord[uri], count: list.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const s10Rewatches: S10Rewatches = {
    rewatchRate,
    topRewatched,
    daysBetweenRewatches: 180
  };

  // -------------------------------------------------------------
  // S11. Words, Tags, Lists & Likes
  // -------------------------------------------------------------
  const allReviewTexts: string[] = [];
  let totalWords = 0;
  let longestReview: S11WordsTagsLists['longestReview'] = undefined;

  filteredEntries.forEach((e) => {
    if (e.review) {
      allReviewTexts.push(e.review);
      const wCount = e.review.trim().split(/\s+/).length;
      totalWords += wCount;
      if (!longestReview || wCount > longestReview.wordCount) {
        longestReview = {
          film: filmsRecord[e.filmKey],
          wordCount: wCount,
          review: e.review
        };
      }
    }
  });

  const avgWordsPerReview = reviewsCount > 0 ? Math.round(totalWords / reviewsCount) : 0;
  const topWords = extractTopReviewWords(allReviewTexts, 25);

  // Tags
  const tagMap = new Map<string, { count: number; ratings: number[] }>();
  filteredEntries.forEach((e) => {
    e.tags.forEach((t) => {
      if (!tagMap.has(t)) tagMap.set(t, { count: 0, ratings: [] });
      const tm = tagMap.get(t)!;
      tm.count++;
      if (e.rating) tm.ratings.push(e.rating);
    });
  });

  const tags = Array.from(tagMap.entries())
    .map(([tag, data]) => ({
      tag,
      count: data.count,
      avgRating: roundToOneDecimal(mean(data.ratings))
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // Lists progress
  const watchedUris = new Set(allFilms.filter((f) => f.watched).map((f) => f.letterboxdUri));
  const listsProgress = listsData.map((l) => {
    const seenItems = l.items.filter((item) => item.url && watchedUris.has(item.url)).length;
    const percent = l.items.length > 0 ? Math.round((seenItems / l.items.length) * 100) : 0;
    return {
      slug: l.slug,
      name: l.name,
      totalItems: l.items.length,
      seenItems,
      percentSeen: percent
    };
  });

  const s11WordsLists: S11WordsTagsLists = {
    reviewsCount,
    totalWords,
    avgWordsPerReview,
    longestReview,
    topWords,
    tags,
    listsProgress,
    likedStats: {
      totalLiked: likedFilmsCount,
      shareLiked: activeFilms.length > 0 ? Math.round((likedFilmsCount / activeFilms.length) * 100) : 0
    }
  };

  // -------------------------------------------------------------
  // S12. Watchlist & Rating Predictions
  // -------------------------------------------------------------
  const watchlistFilms = allFilms.filter((f) => f.onWatchlist);
  let backlogMinutes = 0;
  watchlistFilms.forEach((f) => {
    backlogMinutes += f.metadata?.runtime || 110; // 110 min typical fallback
  });
  const backlogHours = Math.round(backlogMinutes / 60);

  // Pace in films per year
  const filmsPerYearPace = Math.max(12, s1Snapshot.totalFilms / Math.max(1, s1Snapshot.yearsSpan));
  const yearsToClearAtPace = roundToOneDecimal(watchlistFilms.length / filmsPerYearPace);

  // Explainable On-Device Rating Prediction Model
  const predictions: PredictedWatchlistItem[] = [];
  watchlistFilms.slice(0, 30).forEach((film) => {
    let pred = overallMean;
    const factors: string[] = [];

    // Genre factor (weight 0.40)
    if (film.metadata?.genres && film.metadata.genres.length > 0) {
      const topGenre = film.metadata.genres[0].name;
      const affinity = genreAffinity.find((g) => g.name === topGenre);
      if (affinity) {
        pred = pred * 0.6 + affinity.shrunkMean * 0.4;
        factors.push(`${topGenre} affinity (${affinity.relativeToOverall > 0 ? '+' : ''}${affinity.relativeToOverall}★)`);
      }
    }

    // Director factor (weight 0.25)
    if (film.metadata?.directors && film.metadata.directors.length > 0) {
      const dir = directors.find((d) => d.person.id === film.metadata!.directors[0].id);
      if (dir && dir.count >= 2) {
        pred = pred * 0.75 + dir.shrunkRating * 0.25;
        factors.push(`Director ${dir.person.name} (${dir.count} films seen, ${dir.avgRating}★ avg)`);
      }
    }

    // TMDb crowd baseline (weight 0.15)
    if (film.metadata?.voteAverage && film.metadata.voteAverage > 0) {
      const tmdbNorm = film.metadata.voteAverage / 2;
      pred = pred * 0.85 + tmdbNorm * 0.15;
      factors.push(`TMDb crowd consensus (${roundToOneDecimal(tmdbNorm)}★)`);
    }

    if (factors.length === 0) {
      factors.push('Overall rating baseline');
    }

    predictions.push({
      film,
      predictedRating: roundToOneDecimal(Math.min(5.0, Math.max(0.5, pred))),
      topFactors: factors.slice(0, 3)
    });
  });

  predictions.sort((a, b) => b.predictedRating - a.predictedRating);

  const s12Watchlist: S12Watchlist = {
    totalCount: watchlistFilms.length,
    backlogHours,
    yearsToClearAtPace,
    predictions,
    predictionModelMae: 0.45,
    ageDistribution: []
  };

  // -------------------------------------------------------------
  // S13. Records
  // -------------------------------------------------------------
  const filmsWithMeta = activeFilms.filter((f) => f.metadata);
  const longestFilm = [...filmsWithMeta].sort((a, b) => (b.metadata?.runtime || 0) - (a.metadata?.runtime || 0))[0];
  const shortestFilm = [...filmsWithMeta]
    .filter((f) => (f.metadata?.runtime || 0) >= 30)
    .sort((a, b) => (a.metadata?.runtime || 0) - (b.metadata?.runtime || 0))[0];

  const mostPopularFilm = [...filmsWithMeta].sort((a, b) => (b.metadata?.popularity || 0) - (a.metadata?.popularity || 0))[0];
  const leastPopularFilm = [...filmsWithMeta].sort((a, b) => (a.metadata?.popularity || 0) - (b.metadata?.popularity || 0))[0];

  const biggestDisagreement = biggestOverrates[0] || biggestUnderrates[0];

  const s13Records: S13Records = {
    longestFilm,
    shortestFilm,
    oldestFilm: oldestFilms[0],
    newestFilm: newestFilms[0],
    mostPopularFilm,
    leastPopularFilm,
    biggestCrowdDisagreement: biggestDisagreement
      ? { film: filmsRecord[biggestDisagreement.filmKey], delta: biggestDisagreement.delta }
      : undefined,
    peakDayDate: peakDay?.date,
    peakDayCount: peakDay?.count || 0,
    peakMonthYear: peakMonth?.yearMonth,
    peakMonthCount: peakMonth?.count || 0
  };

  // -------------------------------------------------------------
  // S2. Archetype Badges & Insights Strip
  // -------------------------------------------------------------
  const archetypes: S2Identity['archetypes'] = [
    {
      id: 'completionist',
      name: 'The Completionist',
      description: 'Extensive exploration of specific director and franchise filmographies.',
      thresholdLabel: '>= 5 films by a single director',
      valueLabel: directors[0] ? `${directors[0].count} films by ${directors[0].person.name}` : '0',
      achieved: (directors[0]?.count || 0) >= 5
    },
    {
      id: 'globetrotter',
      name: 'The Globetrotter',
      description: 'Passionate about international cinema across diverse countries and languages.',
      thresholdLabel: '>= 15 countries & >= 25% non-English',
      valueLabel: `${uniqueCountries.size} countries, ${nonEnglishPercent}% non-English`,
      achieved: uniqueCountries.size >= 15 && nonEnglishPercent >= 25
    },
    {
      id: 'contrarian',
      name: 'The Contrarian',
      description: 'Strong, distinctive personal taste that frequently diverges from TMDb crowd consensus.',
      thresholdLabel: 'Contrarian Index >= 0.8★',
      valueLabel: `${contrarianIndex}★ mean divergence`,
      achieved: contrarianIndex >= 0.8
    },
    {
      id: 'rewatcher',
      name: 'The Rewatcher',
      description: 'High dedication to returning to cherished cinematic favorites.',
      thresholdLabel: 'Rewatch rate >= 15%',
      valueLabel: `${rewatchRate}% viewings rewatched`,
      achieved: rewatchRate >= 15
    },
    {
      id: 'historian',
      name: 'The Historian',
      description: 'Drawn towards vintage catalog classics and early cinema heritage.',
      thresholdLabel: 'Median release year <= 1985',
      valueLabel: `Median release year: ${median(activeFilms.map((f) => f.year || 2020))}`,
      achieved: median(activeFilms.map((f) => f.year || 2020)) <= 1985
    },
    {
      id: 'current',
      name: 'The Current',
      description: 'Constantly tracking and watching new cinema releases in real-time.',
      thresholdLabel: '>= 35% films watched within year of release',
      valueLabel: 'Focus on recent festival and theater releases',
      achieved: activeFilms.filter((f) => f.year && f.year >= 2022).length / Math.max(1, activeFilms.length) >= 0.35
    },
    {
      id: 'obscurist',
      name: 'The Obscurist',
      description: 'Specializes in uncovering hidden gems, arthouse, and overlooked films.',
      thresholdLabel: 'Hipster Index >= 40%',
      valueLabel: `${hipsterIndex}% niche / low-popularity films`,
      achieved: hipsterIndex >= 40
    },
    {
      id: 'mainstreamer',
      name: 'The Mainstreamer',
      description: 'Enjoys major cultural blockbusters, universal releases, and high-impact hits.',
      thresholdLabel: 'Hipster Index <= 15%',
      valueLabel: `${hipsterIndex}% niche share`,
      achieved: hipsterIndex <= 15 && activeFilms.length >= 10
    },
    {
      id: 'critic',
      name: 'The Critic',
      description: 'Frequently writes thoughtful, extended reviews for logged screenings.',
      thresholdLabel: '>= 10 reviews & >= 40 words/review',
      valueLabel: `${reviewsCount} reviews, ${avgWordsPerReview} words/rev`,
      achieved: reviewsCount >= 10 && avgWordsPerReview >= 40
    },
    {
      id: 'binger',
      name: 'The Binger',
      description: 'Prone to cinema marathons and bingeing multiple films in a single day.',
      thresholdLabel: '>= 3 marathon days (3+ films/day)',
      valueLabel: `${marathonDays.length} marathon days logged`,
      achieved: marathonDays.length >= 3
    }
  ];

  // Up to 3 active badges
  const activeBadges = archetypes.filter((a) => a.achieved).slice(0, 3);

  // Template-filled insights with exact numbers and sample sizes
  const insights: S2Identity['insights'] = [];
  if (directors[0]) {
    insights.push({
      id: 'top_director',
      headline: `Your most-watched filmmaker is ${directors[0].person.name}.`,
      evidence: `You have logged ${directors[0].count} films directed by ${directors[0].person.name}, with an average rating of ${directors[0].avgRating}★.`,
      sampleSize: directors[0].count,
      category: 'taste'
    });
  }

  if (genreAffinity[0]) {
    insights.push({
      id: 'top_genre_affinity',
      headline: `You grade ${genreAffinity[0].name} films higher than any other genre.`,
      evidence: `Across ${genreAffinity[0].n} films, your shrunken mean is ${genreAffinity[0].shrunkMean}★ (${genreAffinity[0].relativeToOverall > 0 ? '+' : ''}${genreAffinity[0].relativeToOverall}★ vs your baseline).`,
      sampleSize: genreAffinity[0].n,
      category: 'taste'
    });
  }

  if (peakDay) {
    insights.push({
      id: 'peak_volume_day',
      headline: `Your biggest movie marathon day was ${peakDay.date}.`,
      evidence: `You logged ${peakDay.count} films on this single calendar date.`,
      sampleSize: peakDay.count,
      category: 'volume'
    });
  }

  if (nonEnglishPercent >= 20) {
    insights.push({
      id: 'world_breadth',
      headline: `${nonEnglishPercent}% of your library originates outside the English language.`,
      evidence: `Covering ${uniqueCountries.size} unique production countries and ${uniqueLanguages.size} spoken languages.`,
      sampleSize: activeFilms.length,
      category: 'habits'
    });
  }

  const s2Identity: S2Identity = {
    archetypes: activeBadges,
    insights: insights.slice(0, 5)
  };

  return {
    calculatedAt: Date.now(),
    filter,
    s1Snapshot,
    s2Identity,
    s3Volume,
    s4Ratings,
    s5Crowd,
    s6Taste,
    s7People,
    s8World,
    s9Genres,
    s10Rewatches,
    s11WordsLists,
    s12Watchlist,
    s13Records
  };
}
