/**
 * Core Domain Entities for Letterboxd Pro Analytics
 */

export type MatchConfidence = 'confident' | 'ambiguous' | 'unmatched';

export type MatchReviewReason =
  | 'exact_title_and_year'
  | 'exact_tie_breaker'
  | 'approximate_year'
  | 'high_score_clear_margin'
  | 'same_title_duplicates'
  | 'no_confident_match'
  | 'no_plausible_match'
  | 'unmatched';

export interface TmdbMatchCandidate {
  id: number;
  title: string;
  originalTitle: string;
  releaseDate?: string;
  year?: number;
  posterPath?: string | null;
  backdropPath?: string | null;
  overview?: string;
  popularity?: number;
  voteAverage?: number;
  voteCount?: number;
  confidenceScore: number;
}

export interface TmdbMatchResult {
  status: MatchConfidence;
  tmdbId?: number;
  score?: number;
  candidates?: TmdbMatchCandidate[];
  manuallyOverridden?: boolean;
  reason?: MatchReviewReason;
  approximateYear?: boolean;
  matchRulesVersion?: number;
}

export interface TmdbPersonCompact {
  id: number;
  name: string;
  profilePath?: string | null;
  character?: string;
  job?: string;
  order?: number;
  gender?: number; // 1 = female, 2 = male, 0 or 3 = unspecified
}

export interface TmdbMovieCompact {
  id: number;
  title: string;
  originalTitle: string;
  releaseDate: string; // YYYY-MM-DD
  releaseYear: number;
  runtime: number; // in minutes
  genres: Array<{ id: number; name: string }>;
  originalLanguage: string;
  spokenLanguages: Array<{ iso_639_1: string; name: string }>;
  productionCountries: Array<{ iso_3166_1: string; name: string }>;
  productionCompanies: Array<{ id: number; name: string }>;
  collection?: { id: number; name: string; posterPath?: string | null; backdropPath?: string | null } | null;
  voteAverage: number;
  voteCount: number;
  popularity: number;
  budget: number;
  revenue: number;
  posterPath?: string | null;
  backdropPath?: string | null;
  certification?: string; // US MPAA: G, PG, PG-13, R, NC-17, NR
  keywords: string[];
  directors: TmdbPersonCompact[];
  cast: TmdbPersonCompact[]; // top 15
  writers: TmdbPersonCompact[];
  cinematographers: TmdbPersonCompact[];
  composers: TmdbPersonCompact[];
  editors: TmdbPersonCompact[];
  producers: TmdbPersonCompact[];
  fetchedAt: number; // timestamp
}

export interface Film {
  letterboxdUri: string; // unique identity key (e.g. https://boxd.it/...)
  name: string;
  year?: number;
  watched: boolean;
  rating?: number; // 0.5 to 5.0 (from ratings.csv or entry fallback)
  liked: boolean;
  onWatchlist: boolean;
  watchlistDate?: string; // YYYY-MM-DD
  match: TmdbMatchResult;
  metadata?: TmdbMovieCompact;
}

export interface Entry {
  entryId: string; // deterministic ID (e.g. uri + index or date)
  filmKey: string; // letterboxdUri
  watchedDate: string | null; // YYYY-MM-DD or null if unknown
  isApproximate: boolean; // true if fell back to log Date
  loggedDate: string; // YYYY-MM-DD
  rating?: number; // 0.5 to 5.0
  rewatch: boolean;
  tags: string[];
  review?: string;
}

export interface ListItem {
  position: number;
  name: string;
  year?: number;
  url?: string; // boxd.it URI
  description?: string;
}

export interface FilmList {
  slug: string;
  name: string;
  date?: string;
  tags: string[];
  url?: string;
  description?: string;
  items: ListItem[];
}

export interface Profile {
  username: string;
  dateJoined?: string; // YYYY-MM-DD
  bio?: string;
  favoriteFilmUris: string[];
  givenName?: string;
}

export interface ImportFileReport {
  fileName: string;
  recordsFound: number;
  recordsAdded: number;
  recordsApplied: number;
  recordsSkipped: number;
  status: 'Processed' | 'Ignored' | 'Merged';
  reason?: string;
  // Backward compatibility aliases
  rowsFound?: number;
  rowsAccepted?: number;
  rowsIgnored?: number;
}

export interface ImportReport {
  importedAt: number;
  files: ImportFileReport[];
  totalUniqueFilms: number;
  totalEntries: number;
  totalReviews: number;
  totalLists: number;
  filmsWithRating: number;
  filmsWatched: number;
  filmsOnWatchlist: number;
  filmsLiked: number;
  filmsDateUnknown: number;
  ratingConflictsResolved: number;
  collisions?: Array<{ title: string; year?: number; uris: string[] }>;
}

export interface IngestionState {
  films: Record<string, Film>; // key = letterboxdUri
  entries: Entry[];
  lists: FilmList[];
  profile?: Profile;
  report: ImportReport;
}
