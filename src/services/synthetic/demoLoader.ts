/**
 * Demo Data Loader
 * Prepares an instant, rich dataset for demonstration, testing, and offline previews.
 */

import { generateSyntheticExportFiles } from './generator.ts';
import { processLetterboxdExport } from '../parser/csvParser.ts';
import { Film, TmdbMovieCompact, TmdbPersonCompact } from '../../types/domain.ts';

const DEMO_DIRECTORS: TmdbPersonCompact[] = [
  { id: 1, name: 'Denis Villeneuve', job: 'Director' },
  { id: 2, name: 'Greta Gerwig', job: 'Director' },
  { id: 3, name: 'Christopher Nolan', job: 'Director' },
  { id: 4, name: 'Hayao Miyazaki', job: 'Director' },
  { id: 5, name: 'Bong Joon-ho', job: 'Director' },
  { id: 6, name: 'Céline Sciamma', job: 'Director' },
  { id: 7, name: 'Guillermo del Toro', job: 'Director' }
];

const DEMO_ACTORS: TmdbPersonCompact[] = [
  { id: 101, name: 'Timothée Chalamet', character: 'Paul Atreides', order: 0, gender: 2 },
  { id: 102, name: 'Saoirse Ronan', character: 'Jo March', order: 0, gender: 1 },
  { id: 103, name: 'Florence Pugh', character: 'Amy March', order: 1, gender: 1 },
  { id: 104, name: 'Song Kang-ho', character: 'Kim Ki-taek', order: 0, gender: 2 },
  { id: 105, name: 'Christian Bale', character: 'Bruce Wayne', order: 0, gender: 2 },
  { id: 106, name: 'Zendaya', character: 'Chani', order: 1, gender: 1 }
];

const DEMO_GENRES = [
  { id: 878, name: 'Science Fiction' },
  { id: 18, name: 'Drama' },
  { id: 12, name: 'Adventure' },
  { id: 16, name: 'Animation' },
  { id: 53, name: 'Thriller' },
  { id: 35, name: 'Comedy' },
  { id: 10749, name: 'Romance' }
];

export function buildDemoEnrichedMovie(index: number, title: string, year: number): TmdbMovieCompact {
  const dir = DEMO_DIRECTORS[index % DEMO_DIRECTORS.length];
  const primaryGenre = DEMO_GENRES[index % DEMO_GENRES.length];
  const secondaryGenre = DEMO_GENRES[(index + 2) % DEMO_GENRES.length];
  const actor1 = DEMO_ACTORS[index % DEMO_ACTORS.length];
  const actor2 = DEMO_ACTORS[(index + 1) % DEMO_ACTORS.length];

  const countries = [
    { iso_3166_1: 'US', name: 'United States of America' },
    { iso_3166_1: 'FR', name: 'France' },
    { iso_3166_1: 'JP', name: 'Japan' },
    { iso_3166_1: 'KR', name: 'South Korea' },
    { iso_3166_1: 'GB', name: 'United Kingdom' }
  ];
  const country = countries[index % countries.length];

  const languages: Record<string, string> = {
    US: 'en',
    GB: 'en',
    FR: 'fr',
    JP: 'ja',
    KR: 'ko'
  };
  const langCode = languages[country.iso_3166_1] || 'en';

  return {
    id: 1000 + index,
    title,
    originalTitle: title,
    releaseDate: `${year}-06-15`,
    releaseYear: year,
    runtime: 95 + (index % 60),
    genres: [primaryGenre, secondaryGenre],
    originalLanguage: langCode,
    spokenLanguages: [{ iso_639_1: langCode, name: langCode.toUpperCase() }],
    productionCountries: [country],
    productionCompanies: [{ id: 50, name: 'A24' }],
    voteAverage: Number((7.0 + ((index % 25) / 10)).toFixed(1)),
    voteCount: 3500 + index * 120,
    popularity: Number((12.5 + ((index % 80) * 0.9)).toFixed(1)),
    budget: 35000000,
    revenue: 125000000,
    posterPath: null,
    backdropPath: null,
    certification: index % 3 === 0 ? 'PG-13' : index % 4 === 0 ? 'R' : 'PG',
    keywords: ['masterpiece', 'journey', 'cinema', 'classic'],
    directors: [dir],
    cast: [actor1, actor2],
    writers: [{ id: 300 + index, name: `${dir.name}`, job: 'Screenplay' }],
    cinematographers: [{ id: 400 + (index % 5), name: 'Roger Deakins', job: 'Cinematographer' }],
    composers: [{ id: 500 + (index % 5), name: 'Hans Zimmer', job: 'Original Music Composer' }],
    editors: [{ id: 600 + (index % 5), name: 'Joe Walker', job: 'Editor' }],
    producers: [{ id: 700 + index, name: 'Producer Guild', job: 'Producer' }],
    fetchedAt: Date.now()
  };
}

export function generateDemoDataset(filmCount = 120) {
  const files = generateSyntheticExportFiles({ filmCount });
  const map = new Map<string, string>();
  for (const [name, u8] of Object.entries(files)) {
    map.set(name, new TextDecoder().decode(u8));
  }

  const parsed = processLetterboxdExport(map);
  const enrichedFilms: Record<string, Film> = {};

  let idx = 0;
  for (const [uri, film] of Object.entries(parsed.films)) {
    const movie = buildDemoEnrichedMovie(idx, film.name, film.year || 2020);
    enrichedFilms[uri] = {
      ...film,
      match: {
        tmdbId: movie.id,
        score: 0.98,
        status: 'confident'
      },
      metadata: movie
    };
    idx++;
  }

  return {
    films: enrichedFilms,
    entries: parsed.entries,
    lists: parsed.lists,
    profile: parsed.profile,
    report: parsed.report
  };
}
