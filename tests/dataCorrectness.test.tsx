import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { generateSyntheticExportFiles } from '../src/services/synthetic/generator.ts';
import { processLetterboxdExport } from '../src/services/parser/csvParser.ts';
import { calculateAnalyticsSnapshot } from '../src/services/analytics/engine.ts';
import { S3VolumeSection } from '../src/components/sections/S3VolumeSection.tsx';
import { PeoplePortraits } from '../src/components/charts/PeoplePortraits.tsx';
import { Film, Entry } from '../src/types/domain.ts';
import { S3Volume, RankedPerson } from '../src/services/analytics/types.ts';
import { createMockMovie } from './mocks/mockTmdb.ts';

describe('Phase B: Data Correctness & Cross-Section Invariants', () => {
  it('1. Rewatches & Rewatch Delta: accurately computes rewatch rating deltas and counts', () => {
    const filesMap = new Map<string, string>();
    filesMap.set(
      'watched.csv',
      'Date,Name,Year,Letterboxd URI\n' +
        '2022-01-01,Movie A,2020,https://boxd.it/film_a\n' +
        '2022-01-01,Movie B,2020,https://boxd.it/film_b\n'
    );
    filesMap.set(
      'diary.csv',
      'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n' +
        '2022-01-01,Movie A,2020,https://boxd.it/entry1,3.0,No,"",2022-01-01\n' +
        '2022-06-01,Movie A,2020,https://boxd.it/entry2,4.5,Yes,"",2022-06-01\n' +
        '2022-02-01,Movie B,2020,https://boxd.it/entry3,5.0,No,"",2022-02-01\n' +
        '2022-08-01,Movie B,2020,https://boxd.it/entry4,3.5,Yes,"",2022-08-01\n'
    );

    const parsed = processLetterboxdExport(filesMap);
    const snapshot = calculateAnalyticsSnapshot(parsed.films, parsed.entries, parsed.lists, parsed.profile, { range: 'all' });

    // Movie A went from 3.0 to 4.5 (+1.5)
    // Movie B went from 5.0 to 3.5 (-1.5)
    // Average delta = 0.00, totalRewatched = 2, higherCount = 1, lowerCount = 1
    expect(snapshot.s4Ratings.rewatchRatingDelta.totalRewatched).toBe(2);
    expect(snapshot.s4Ratings.rewatchRatingDelta.higherCount).toBe(1);
    expect(snapshot.s4Ratings.rewatchRatingDelta.lowerCount).toBe(1);
    expect(snapshot.s4Ratings.rewatchRatingDelta.sameCount).toBe(0);
    expect(snapshot.s4Ratings.rewatchRatingDelta.averageDelta).toBe(0);
    expect(snapshot.s10Rewatches.topRewatched.length).toBe(2);
  });

  it('2. 5-Star Club & Unliked 5-Stars: total 5★ films equals histogram 5.0 bar, and unliked count <= total 5★', () => {
    const files = generateSyntheticExportFiles({ filmCount: 100 });
    const filesMap = new Map<string, string>();
    for (const [name, u8] of Object.entries(files)) {
      filesMap.set(name, new TextDecoder().decode(u8));
    }

    const parsed = processLetterboxdExport(filesMap);
    const snapshot = calculateAnalyticsSnapshot(parsed.films, parsed.entries, parsed.lists, parsed.profile, { range: 'all' });

    const fiveStarHistogramBar = snapshot.s4Ratings.histogram.find((b) => b.rating === 5.0)?.count || 0;
    const totalFiveStarFilms = snapshot.s4Ratings.topRatedFilms.length;
    const unlikedFiveStars = snapshot.s4Ratings.likedVsRated.unlikedFiveStars.length;

    // Invariant: The 5★ total must equal the 5.0 bar of the ratings histogram
    expect(totalFiveStarFilms).toBe(fiveStarHistogramBar);
    // Invariant: unliked 5★ can never exceed total 5★ count
    expect(unlikedFiveStars).toBeLessThanOrEqual(totalFiveStarFilms);
  });

  it('3. Cross-Section Consistency Invariants over Synthetic Fixture', () => {
    const files = generateSyntheticExportFiles({ filmCount: 200 });
    const filesMap = new Map<string, string>();
    for (const [name, u8] of Object.entries(files)) {
      filesMap.set(name, new TextDecoder().decode(u8));
    }

    const parsed = processLetterboxdExport(filesMap);
    const snapshot = calculateAnalyticsSnapshot(parsed.films, parsed.entries, parsed.lists, parsed.profile, { range: 'all' });

    // Invariant 1: Total active films in snapshot equals parsed watched films
    expect(snapshot.s1Snapshot.totalFilms).toBe(parsed.report.filmsWatched);

    // Invariant 2: Total rated films equals sum of histogram counts
    const histogramSum = snapshot.s4Ratings.histogram.reduce((sum, b) => sum + b.count, 0);
    expect(histogramSum).toBe(snapshot.s1Snapshot.ratedFilmsCount);

    // Invariant 3: Liked films count never exceeds total films
    expect(snapshot.s1Snapshot.likedFilmsCount).toBeLessThanOrEqual(snapshot.s1Snapshot.totalFilms);

    // Invariant 4: Sum of weekday counts equals total dated entries
    const datedEntriesCount = parsed.entries.filter((e) => e.watchedDate !== null).length;
    const weekdaySum = snapshot.s3Volume.weekdayDistribution.reduce((sum, w) => sum + w.count, 0);
    expect(weekdaySum).toBe(datedEntriesCount);

    // Invariant 5: Yearly volume viewings sum equals dated entries count
    const yearlyViewingsSum = snapshot.s3Volume.yearlyVolume.reduce((sum, y) => sum + y.viewingsCount, 0);
    expect(yearlyViewingsSum).toBe(datedEntriesCount);
  });

  it('5. Most Generous / Harshest Year: smoothed with Bayesian shrinkage (k=5, min N=5)', () => {
    // Construct scenario with 3 films of 5.0★ in 1930 (N=3 or N=4) and 15 films of 4.4★ in 1999 (N=15)
    // With min N=5 and Bayesian shrinkage (k=5), 1930 is shrunk or disqualified (< 5), so 1999 wins!
    const mockFilms: Record<string, Film> = {};

    // 4 films for 1930 with 5.0★
    for (let i = 1; i <= 4; i++) {
      mockFilms[`film_1930_${i}`] = {
        letterboxdUri: `film_1930_${i}`,
        name: `1930 Film ${i}`,
        year: 1930,
        rating: 5.0,
        watched: true,
        liked: false,
        onWatchlist: false,
        match: { status: 'confident', tmdbId: 100 + i }
      };
    }

    // 10 films for 1999 with avg rating 4.4
    for (let i = 1; i <= 10; i++) {
      mockFilms[`film_1999_${i}`] = {
        letterboxdUri: `film_1999_${i}`,
        name: `1999 Film ${i}`,
        year: 1999,
        rating: 4.4,
        watched: true,
        liked: false,
        onWatchlist: false,
        match: { status: 'confident', tmdbId: 200 + i }
      };
    }

    // 10 films for 2010 with avg rating 2.0
    for (let i = 1; i <= 10; i++) {
      mockFilms[`film_2010_${i}`] = {
        letterboxdUri: `film_2010_${i}`,
        name: `2010 Film ${i}`,
        year: 2010,
        rating: 2.0,
        watched: true,
        liked: false,
        onWatchlist: false,
        match: { status: 'confident', tmdbId: 300 + i }
      };
    }

    const entries: Entry[] = Object.keys(mockFilms).map((k, idx) => ({
      entryId: `e_${idx}`,
      filmKey: k,
      watchedDate: '2023-01-01',
      isApproximate: false,
      loggedDate: '2023-01-01',
      rewatch: false,
      tags: []
    }));

    const snapshot = calculateAnalyticsSnapshot(mockFilms, entries, [], undefined, { range: 'all' });

    // 1930 has only N=4, so it should NOT qualify for most generous year (min N=5 required)
    expect(snapshot.s4Ratings.mostGenerousYear?.year).toBe(1999);
    expect(snapshot.s4Ratings.mostGenerousYear?.shrunkRating).toBeDefined();
    expect(snapshot.s4Ratings.harshestYear?.year).toBe(2010);
  });

  it('6. Cast Ranking: splits into Actors (gender=2) and Actresses (gender=1) with All Cast', () => {
    const mockMovie = createMockMovie(1, 'Film 1', 2020);
    mockMovie.cast = [
      { id: 10, name: 'Actor Male', gender: 2 },
      { id: 20, name: 'Actress Female', gender: 1 }
    ];

    const mockFilms: Record<string, Film> = {
      'film1': {
        letterboxdUri: 'film1',
        name: 'Film 1',
        year: 2020,
        rating: 4.0,
        watched: true,
        liked: false,
        onWatchlist: false,
        match: { status: 'confident', tmdbId: 1 },
        metadata: mockMovie
      }
    };

    const entries: Entry[] = [{
      entryId: 'e1',
      filmKey: 'film1',
      watchedDate: '2020-01-01',
      isApproximate: false,
      loggedDate: '2020-01-01',
      rewatch: false,
      tags: []
    }];

    const snapshot = calculateAnalyticsSnapshot(mockFilms, entries, [], undefined, { range: 'all' });

    expect(snapshot.s7People.actors.some((p) => p.person.name === 'Actor Male')).toBe(true);
    expect(snapshot.s7People.actors.some((p) => p.person.name === 'Actress Female')).toBe(false);

    expect(snapshot.s7People.actresses.some((p) => p.person.name === 'Actress Female')).toBe(true);
    expect(snapshot.s7People.actresses.some((p) => p.person.name === 'Actor Male')).toBe(false);

    expect(snapshot.s7People.allCast.length).toBe(2);
  });

  it('4. Day of the Week Habits: bar heights differ proportionally, peak is highlighted, count/share displayed', () => {
    const mockVolume: S3Volume = {
      yearlyVolume: [],
      yearMonthMatrix: [],
      monthSeasonality: [],
      weekdayDistribution: [
        { weekday: 1, name: 'Mon', count: 50, sharePercent: 25 },
        { weekday: 2, name: 'Tue', count: 25, sharePercent: 12 },
        { weekday: 3, name: 'Wed', count: 100, sharePercent: 50 }, // Peak
        { weekday: 4, name: 'Thu', count: 10, sharePercent: 5 },
        { weekday: 5, name: 'Fri', count: 5, sharePercent: 3 },
        { weekday: 6, name: 'Sat', count: 5, sharePercent: 3 },
        { weekday: 7, name: 'Sun', count: 5, sharePercent: 3 }
      ],
      trailing365Calendar: [],
      yearlyCalendars: {},
      streaks: {
        currentStreakDays: 1,
        isCurrentStreakActive: true,
        longestStreakDays: 5,
        longestGapDays: 2
      },
      busiestDay: null,
      busiestMonth: null,
      marathonDays: [],
      currentYearPace: {
        projectedFilms: 100,
        filmsSoFar: 50,
        dayOfYear: 100,
        daysInYear: 365
      },
      backlogLoggingLag: [],
      dateUnknownCount: 42
    };

    render(
      <S3VolumeSection
        volume={mockVolume}
        onSelectDay={() => {}}
        onSelectMarathon={() => {}}
      />
    );

    // Verify "42 films without a watch date are not shown" appears
    expect(screen.getAllByText(/42 films without a watch date are not shown/i).length).toBeGreaterThan(0);

    // Verify peak badge appears for peak day (Wed)
    expect(screen.getByText('Peak')).toBeInTheDocument();

    // Verify counts and shares are rendered
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();

    // Verify bar heights differ proportionally
    const wedBar = screen.getByTestId('weekday-bar-wed');
    const monBar = screen.getByTestId('weekday-bar-mon');
    const thuBar = screen.getByTestId('weekday-bar-thu');

    // Wed is 100/100 -> 100% height
    expect(wedBar.style.height).toBe('100%');
    // Mon is 50/100 -> 50% height
    expect(monBar.style.height).toBe('50%');
    // Thu is 10/100 -> 10% height
    expect(thuBar.style.height).toBe('10%');
  });

  it('6b. Cast Ranking UI: toggles between All Cast, Actors, and Actresses with state preservation', () => {
    const mockMale: RankedPerson = {
      person: { id: 1, name: 'Leonardo DiCaprio', gender: 2 },
      count: 5,
      avgRating: 4.5,
      shrunkRating: 4.2,
      filmKeys: ['film1']
    };

    const mockFemale: RankedPerson = {
      person: { id: 2, name: 'Scarlett Johansson', gender: 1 },
      count: 4,
      avgRating: 4.3,
      shrunkRating: 4.1,
      filmKeys: ['film2']
    };

    render(
      <PeoplePortraits
        directors={[]}
        actors={[mockMale]}
        actresses={[mockFemale]}
        allCast={[mockMale, mockFemale]}
        writers={[]}
        cinematographers={[]}
        composers={[]}
        overallMean={3.5}
        onSelectPerson={() => {}}
      />
    );

    // Assert Cast tab is replaced by direct Actors and Actresses tabs
    expect(screen.queryByRole('button', { name: 'Cast' })).not.toBeInTheDocument();

    const actorsTab = screen.getByRole('button', { name: 'Actors' });
    const actressesTab = screen.getByRole('button', { name: 'Actresses' });
    expect(actorsTab).toBeInTheDocument();
    expect(actressesTab).toBeInTheDocument();

    // Click direct Actors tab
    fireEvent.click(actorsTab);
    expect(screen.getByText('Leonardo DiCaprio')).toBeInTheDocument();
    expect(screen.queryByText('Scarlett Johansson')).not.toBeInTheDocument();

    // Click direct Actresses tab
    fireEvent.click(actressesTab);
    expect(screen.queryByText('Leonardo DiCaprio')).not.toBeInTheDocument();
    expect(screen.getByText('Scarlett Johansson')).toBeInTheDocument();
  });
});
