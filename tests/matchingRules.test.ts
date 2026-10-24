import { describe, it, expect } from 'vitest';
import {
  normalizeTitle,
  scoreCandidate,
  classifyCandidates,
  candidateTieBreaker,
  rescoreFilmMatch,
  MATCH_RULES_VERSION
} from '../src/services/tmdb/matching.ts';
import { TmdbMatchCandidate, Film } from '../src/types/domain.ts';

describe('Phase 2: TMDb Matching Engine & Title Normalization Rules', () => {
  describe('Title Normalization & Roman Numerals', () => {
    it('normalizes diacritics, case, leading articles, punctuation, and &', () => {
      expect(normalizeTitle('The Lord of the Rings: The Fellowship of the Ring')).toBe(
        'lord of the rings the fellowship of the ring'
      );
      expect(normalizeTitle('Amélie')).toBe('amelie');
      expect(normalizeTitle('Fast & Furious')).toBe('fast and furious');
      expect(normalizeTitle("L'Avventura")).toBe('avventura');
      expect(normalizeTitle('Les Misérables')).toBe('miserables');
    });

    it('standardizes Roman numerals to Arabic numbers in Part and Volume titles', () => {
      expect(normalizeTitle('The Godfather: Part II')).toBe('godfather part 2');
      expect(normalizeTitle('Kill Bill: Vol. 1')).toBe('kill bill vol 1');
      expect(normalizeTitle('Guardians of the Galaxy Vol. 3')).toBe('guardians of the galaxy vol 3');
      expect(normalizeTitle('Mission: Impossible - Part One')).toBe('mission impossible part one');
    });
  });

  describe('Scoring Rules & Score Capping', () => {
    it('exact title and exact year scores 1.0', () => {
      const score = scoreCandidate('Justice League', 2017, 'Justice League', 'Justice League', 2017, 22.26);
      expect(score).toBe(1.0);
    });

    it('exact title with year off by one scores 0.90', () => {
      const score = scoreCandidate('Parasite', 2019, 'Parasite', 'Gisaengchung', 2020, 35.0);
      expect(score).toBe(0.90);
    });

    it('partial containment match is strictly capped at <= 0.75 and cannot rival an exact match', () => {
      const scoreJL = scoreCandidate('Justice League', 2017, 'Justice League', 'Justice League', 2017, 22.26);
      const scoreJLDark = scoreCandidate('Justice League', 2017, 'Justice League Dark', 'Justice League Dark', 2017, 6.71);

      expect(scoreJL).toBe(1.0);
      expect(scoreJLDark).toBeLessThanOrEqual(0.75);
      expect(scoreJL - scoreJLDark).toBeGreaterThanOrEqual(0.25);
    });

    it('regression: lower-ranked partial or containment title can never outrank an exact match', () => {
      const exactCandidate = scoreCandidate('Spider-Man', 2002, 'Spider-Man', 'Spider-Man', 2002, 10.0);
      const partialCandidate = scoreCandidate('Spider-Man', 2002, 'Spider-Man: Across the Spider-Verse', 'Spider-Man: Across the Spider-Verse', 2023, 100.0);

      expect(exactCandidate).toBe(1.0);
      expect(partialCandidate).toBeLessThanOrEqual(0.75);
      expect(exactCandidate).toBeGreaterThan(partialCandidate);
    });
  });

  describe('Classification & Auto-Acceptance', () => {
    it('"Justice League (2017)" auto-accepts and is not blocked by Justice League Dark', () => {
      const cand1: TmdbMatchCandidate = {
        id: 141052,
        title: 'Justice League',
        originalTitle: 'Justice League',
        year: 2017,
        confidenceScore: scoreCandidate('Justice League', 2017, 'Justice League', 'Justice League', 2017, 22.26),
        posterPath: '/jl.jpg',
        voteCount: 14000
      };

      const cand2: TmdbMatchCandidate = {
        id: 408220,
        title: 'Justice League Dark',
        originalTitle: 'Justice League Dark',
        year: 2017,
        confidenceScore: scoreCandidate('Justice League', 2017, 'Justice League Dark', 'Justice League Dark', 2017, 6.71),
        posterPath: '/jld.jpg',
        voteCount: 1100
      };

      const classification = classifyCandidates([cand1, cand2], 'Justice League', 2017);
      expect(classification.status).toBe('confident');
      expect(classification.topCandidate?.id).toBe(141052);
      expect(classification.reason).toBe('exact_title_and_year');
    });

    it('"Vice (2018)" and "Brooklyn (2015)" auto-accept without ambiguity', () => {
      const viceCand: TmdbMatchCandidate = {
        id: 429197,
        title: 'Vice',
        originalTitle: 'Vice',
        year: 2018,
        confidenceScore: scoreCandidate('Vice', 2018, 'Vice', 'Vice', 2018, 14.5),
        posterPath: '/vice.jpg',
        voteCount: 3000
      };
      const viceClass = classifyCandidates([viceCand], 'Vice', 2018);
      expect(viceClass.status).toBe('confident');
      expect(viceClass.reason).toBe('exact_title_and_year');

      const brooklynCand: TmdbMatchCandidate = {
        id: 167073,
        title: 'Brooklyn',
        originalTitle: 'Brooklyn',
        year: 2015,
        confidenceScore: scoreCandidate('Brooklyn', 2015, 'Brooklyn', 'Brooklyn', 2015, 12.0),
        posterPath: '/brooklyn.jpg',
        voteCount: 3500
      };
      const brooklynClass = classifyCandidates([brooklynCand], 'Brooklyn', 2015);
      expect(brooklynClass.status).toBe('confident');
      expect(brooklynClass.reason).toBe('exact_title_and_year');
    });

    it('two films with the same exact title and year use tie-breaker when gap is large, else review', () => {
      // Denis Villeneuve Arrival vs obscure short Arrival
      const candMajor: TmdbMatchCandidate = {
        id: 329865,
        title: 'Arrival',
        originalTitle: 'Arrival',
        year: 2016,
        confidenceScore: 1.0,
        voteCount: 20073,
        popularity: 27.7,
        posterPath: '/arrival.jpg'
      };
      const candMinor: TmdbMatchCandidate = {
        id: 472349,
        title: 'Arrival',
        originalTitle: 'Arrival',
        year: 2016,
        confidenceScore: 1.0,
        voteCount: 9,
        popularity: 1.2,
        posterPath: '/minor.jpg'
      };

      expect(candidateTieBreaker(candMajor, candMinor)).toBe(true);

      const tieClass = classifyCandidates([candMajor, candMinor], 'Arrival', 2016);
      expect(tieClass.status).toBe('confident');
      expect(tieClass.reason).toBe('exact_tie_breaker');
      expect(tieClass.topCandidate?.id).toBe(329865);

      // Genuinely comparable duplicates with similar vote counts go to review
      const candComp1: TmdbMatchCandidate = {
        id: 111,
        title: 'Test Duplicate',
        originalTitle: 'Test Duplicate',
        year: 2020,
        confidenceScore: 1.0,
        voteCount: 15,
        popularity: 2.0,
        posterPath: '/a.jpg'
      };
      const candComp2: TmdbMatchCandidate = {
        id: 222,
        title: 'Test Duplicate',
        originalTitle: 'Test Duplicate',
        year: 2020,
        confidenceScore: 1.0,
        voteCount: 12,
        popularity: 1.8,
        posterPath: '/b.jpg'
      };

      const compClass = classifyCandidates([candComp1, candComp2], 'Test Duplicate', 2020);
      expect(compClass.status).toBe('ambiguous');
      expect(compClass.reason).toBe('same_title_duplicates');
    });

    it('a film one year off with exact title is accepted with approximate_year flag', () => {
      const candApprox: TmdbMatchCandidate = {
        id: 999,
        title: 'Festival Film',
        originalTitle: 'Festival Film',
        year: 2019,
        confidenceScore: 0.90,
        voteCount: 50,
        posterPath: '/fest.jpg'
      };

      const approxClass = classifyCandidates([candApprox], 'Festival Film', 2020);
      expect(approxClass.status).toBe('confident');
      expect(approxClass.reason).toBe('approximate_year');
      expect(approxClass.approximateYear).toBe(true);
    });

    it('nonsense title is classified as unmatched', () => {
      const nonsenseClass = classifyCandidates([], 'Asdfghjkl Qwertyuiop', 2022);
      expect(nonsenseClass.status).toBe('unmatched');
      expect(nonsenseClass.reason).toBe('unmatched');
    });
  });

  describe('Rescoring Migration', () => {
    it('upgrades an ambiguous film from cached candidates to confident without network calls', () => {
      const oldFilm: Film = {
        letterboxdUri: 'https://boxd.it/test_jl',
        name: 'Justice League',
        year: 2017,
        watched: true,
        liked: false,
        onWatchlist: false,
        match: {
          status: 'ambiguous',
          score: 1.0,
          matchRulesVersion: 1, // legacy version
          candidates: [
            {
              id: 141052,
              title: 'Justice League',
              originalTitle: 'Justice League',
              year: 2017,
              confidenceScore: 1.0,
              posterPath: '/jl.jpg',
              voteCount: 14000
            },
            {
              id: 408220,
              title: 'Justice League Dark',
              originalTitle: 'Justice League Dark',
              year: 2017,
              confidenceScore: 0.97,
              posterPath: '/jld.jpg',
              voteCount: 1100
            }
          ]
        }
      };

      const rescored = rescoreFilmMatch(oldFilm);
      expect(rescored.status).toBe('confident');
      expect(rescored.tmdbId).toBe(141052);
      expect(rescored.matchRulesVersion).toBe(MATCH_RULES_VERSION);
      expect(rescored.reason).toBe('exact_title_and_year');
    });

    it('never touches matches that were manually overridden by the user', () => {
      const userSelectedFilm: Film = {
        letterboxdUri: 'https://boxd.it/user_selected',
        name: 'Custom Title',
        year: 2020,
        watched: true,
        liked: false,
        onWatchlist: false,
        match: {
          status: 'confident',
          tmdbId: 777,
          score: 1.0,
          manuallyOverridden: true,
          matchRulesVersion: 1
        }
      };

      const rescored = rescoreFilmMatch(userSelectedFilm);
      expect(rescored.tmdbId).toBe(777);
      expect(rescored.manuallyOverridden).toBe(true);
    });
  });
});
