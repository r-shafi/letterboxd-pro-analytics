/**
 * Deterministic Mock TMDb Service Double
 * Provides repeatable responses for tests without hitting real network.
 */

import { TmdbMovieCompact, TmdbMatchResult, TmdbPersonCompact } from '../../src/types/domain.ts';

export const MOCK_GENRES = [
  { id: 28, name: 'Action' },
  { id: 12, name: 'Adventure' },
  { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' },
  { id: 18, name: 'Drama' },
  { id: 878, name: 'Science Fiction' },
  { id: 53, name: 'Thriller' }
];

export const MOCK_DIRECTORS: TmdbPersonCompact[] = [
  { id: 1, name: 'George Lucas', job: 'Director' },
  { id: 2, name: 'Jean-Pierre Jeunet', job: 'Director' },
  { id: 3, name: 'Bong Joon-ho', job: 'Director' },
  { id: 4, name: 'Christopher Nolan', job: 'Director' },
  { id: 5, name: 'Greta Gerwig', job: 'Director' },
  { id: 6, name: 'Denis Villeneuve', job: 'Director' },
  { id: 7, name: 'Hayao Miyazaki', job: 'Director' }
];

export function createMockMovie(id: number, title: string, year = 2020): TmdbMovieCompact {
  const dir = MOCK_DIRECTORS[id % MOCK_DIRECTORS.length];
  const genre = MOCK_GENRES[id % MOCK_GENRES.length];

  return {
    id,
    title,
    originalTitle: title,
    releaseDate: `${year}-05-25`,
    releaseYear: year,
    runtime: 100 + (id % 60), // 100 to 159 minutes
    genres: [genre, { id: 18, name: 'Drama' }],
    originalLanguage: id % 4 === 0 ? 'fr' : id % 5 === 0 ? 'ja' : 'en',
    spokenLanguages: [{ iso_639_1: 'en', name: 'English' }],
    productionCountries: [
      id % 4 === 0
        ? { iso_3166_1: 'FR', name: 'France' }
        : id % 5 === 0
        ? { iso_3166_1: 'JP', name: 'Japan' }
        : { iso_3166_1: 'US', name: 'United States of America' }
    ],
    productionCompanies: [{ id: 100, name: 'Studio A' }],
    voteAverage: 6.5 + (id % 30) / 10, // 6.5 to 9.4
    voteCount: 1500 + id * 10,
    popularity: 45.2,
    budget: 50000000,
    revenue: 150000000,
    posterPath: `/mock_poster_${id}.jpg`,
    backdropPath: `/mock_backdrop_${id}.jpg`,
    certification: id % 3 === 0 ? 'PG-13' : id % 4 === 0 ? 'R' : 'PG',
    keywords: ['cinema', 'journey', 'epic', 'award winner'],
    directors: [dir],
    cast: [
      { id: 101, name: 'Lead Actor A', character: 'Hero', order: 0 },
      { id: 102, name: 'Supporting Actor B', character: 'Friend', order: 1 }
    ],
    writers: [{ id: 201, name: 'Writer A', job: 'Screenplay' }],
    cinematographers: [{ id: 301, name: 'DOP A', job: 'Cinematographer' }],
    composers: [{ id: 401, name: 'Composer A', job: 'Original Music Composer' }],
    editors: [{ id: 501, name: 'Editor A', job: 'Editor' }],
    producers: [{ id: 601, name: 'Producer A', job: 'Producer' }],
    fetchedAt: Date.now()
  };
}

export class MockTmdbService {
  public callCount = 0;
  public simulate429Count = 0;

  public async matchFilm(name: string, year?: number): Promise<TmdbMatchResult> {
    this.callCount++;

    if (this.simulate429Count > 0) {
      this.simulate429Count--;
      throw new Error('TMDb Rate Limit Exceeded (HTTP 429)');
    }

    if (name.includes('Nonexistent')) {
      return { status: 'unmatched' };
    }

    const mockId = Math.abs(this.hashString(name));
    return {
      status: 'confident',
      tmdbId: mockId,
      score: 0.96,
      candidates: [
        {
          id: mockId,
          title: name,
          originalTitle: name,
          year: year || 2020,
          confidenceScore: 0.96,
          posterPath: `/mock_poster_${mockId}.jpg`
        }
      ]
    };
  }

  public async enrichMovie(id: number): Promise<TmdbMovieCompact> {
    this.callCount++;
    return createMockMovie(id, `Mock Movie ${id}`);
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) || 1;
  }
}
