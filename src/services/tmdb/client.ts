/**
 * TMDb API Client
 * Supports v3 API Key, v4 Read Access Token (Bearer),
 * In-memory and persistent caching, adaptive concurrency limiter,
 * search cascade, and compact metadata enrichment.
 */

import { CONFIG } from '../../config/env.ts';
import {
  TmdbMovieCompact,
  TmdbPersonCompact,
  TmdbMatchResult,
  TmdbMatchCandidate
} from '../../types/domain.ts';
import { AdaptiveRateLimiter } from './limiter.ts';
import { scoreCandidate, classifyCandidates } from './matching.ts';
import { storage } from '../../utils/storage.ts';

export interface TmdbClientConfig {
  apiKeyOrToken?: string;
  apiBase?: string;
  imageBase?: string;
}

export class TmdbClient {
  private keyOrToken: string;
  private apiBase: string;
  private imageBase: string;
  private limiter: AdaptiveRateLimiter;

  // In-memory caches to deduplicate in-flight and repeated requests
  private matchMemoryCache = new Map<string, TmdbMatchResult>();
  private movieMemoryCache = new Map<number, TmdbMovieCompact>();
  private inFlightSearches = new Map<string, Promise<TmdbMatchResult>>();
  private inFlightEnrichments = new Map<number, Promise<TmdbMovieCompact>>();

  constructor(cfg?: TmdbClientConfig) {
    this.keyOrToken = cfg?.apiKeyOrToken || this.loadUserKey() || CONFIG.tmdbFallbackKey;
    this.apiBase = cfg?.apiBase || CONFIG.tmdbApiBase;
    this.imageBase = cfg?.imageBase || CONFIG.tmdbImageBase;
    this.limiter = new AdaptiveRateLimiter(10, 25);
  }

  public getImageBase(): string {
    return this.imageBase;
  }

  public getLimiter(): AdaptiveRateLimiter {
    return this.limiter;
  }

  public setApiKeyOrToken(key: string): void {
    this.keyOrToken = key.trim();
    if (this.keyOrToken) {
      localStorage.setItem('lb_tmdb_user_key', this.keyOrToken);
    } else {
      localStorage.removeItem('lb_tmdb_user_key');
      this.keyOrToken = CONFIG.tmdbFallbackKey;
    }
  }

  public getActiveKey(): string {
    return this.keyOrToken;
  }

  public isUsingUserKey(): boolean {
    return Boolean(this.loadUserKey());
  }

  private loadUserKey(): string {
    try {
      return localStorage.getItem('lb_tmdb_user_key') || '';
    } catch {
      return '';
    }
  }

  private isV4Token(token: string): boolean {
    return token.length > 50 || token.startsWith('ey');
  }

  /**
   * Internal HTTP fetch wrapper applying rate limiting, v3/v4 auth, and error handling.
   */
  public async fetchJson<T>(endpoint: string, params: Record<string, string | number | boolean> = {}): Promise<T> {
    return this.limiter.schedule(async () => {
      const url = new URL(`${this.apiBase}${endpoint}`);
      const headers: Record<string, string> = {
        Accept: 'application/json'
      };

      if (this.isV4Token(this.keyOrToken)) {
        headers['Authorization'] = `Bearer ${this.keyOrToken}`;
      } else {
        url.searchParams.set('api_key', this.keyOrToken);
      }

      Object.entries(params).forEach(([k, v]) => {
        url.searchParams.set(k, String(v));
      });

      const response = await fetch(url.toString(), { headers });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('TMDb Rate Limit Exceeded (HTTP 429)');
        }
        if (response.status === 401 || response.status === 403) {
          throw new Error('Invalid TMDb API Key or Token (HTTP 401/403)');
        }
        throw new Error(`TMDb Request failed: HTTP ${response.status} on ${endpoint}`);
      }

      return (await response.json()) as T;
    });
  }

  /**
   * Verifies if a given TMDb key/token is valid via a lightweight call.
   */
  public async validateKey(keyToTest: string): Promise<boolean> {
    try {
      const url = new URL(`${this.apiBase}/configuration`);
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (this.isV4Token(keyToTest)) {
        headers['Authorization'] = `Bearer ${keyToTest}`;
      } else {
        url.searchParams.set('api_key', keyToTest);
      }
      const res = await fetch(url.toString(), { headers });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Hydrates caches from persistent storage on startup.
   */
  public async hydrateCaches(): Promise<void> {
    const cachedMatches = await storage.getItem<Record<string, TmdbMatchResult>>('cache:matches');
    if (cachedMatches) {
      Object.entries(cachedMatches).forEach(([k, v]) => this.matchMemoryCache.set(k, v));
    }

    const cachedMovies = await storage.getItem<Record<string, TmdbMovieCompact>>('cache:movies');
    if (cachedMovies) {
      Object.entries(cachedMovies).forEach(([k, v]) => this.movieMemoryCache.set(Number(k), v));
    }
  }

  /**
   * Flushes current memory caches to persistent storage.
   */
  public async persistCaches(): Promise<void> {
    const matchObj: Record<string, TmdbMatchResult> = {};
    this.matchMemoryCache.forEach((v, k) => {
      matchObj[k] = v;
    });
    await storage.setItem('cache:matches', matchObj);

    const movieObj: Record<string, TmdbMovieCompact> = {};
    this.movieMemoryCache.forEach((v, k) => {
      movieObj[String(k)] = v;
    });
    await storage.setItem('cache:movies', movieObj);
  }

  /**
   * Matches a film name and year to TMDb using a multi-step search cascade.
   */
  public async matchFilm(name: string, year?: number): Promise<TmdbMatchResult> {
    const cacheKey = `${name.toLowerCase()}::${year || ''}`;

    if (this.matchMemoryCache.has(cacheKey)) {
      return this.matchMemoryCache.get(cacheKey)!;
    }

    if (this.inFlightSearches.has(cacheKey)) {
      return this.inFlightSearches.get(cacheKey)!;
    }

    const searchPromise = this.performSearchCascade(name, year);
    this.inFlightSearches.set(cacheKey, searchPromise);

    try {
      const result = await searchPromise;
      this.matchMemoryCache.set(cacheKey, result);
      return result;
    } finally {
      this.inFlightSearches.delete(cacheKey);
    }
  }

  private async performSearchCascade(name: string, year?: number): Promise<TmdbMatchResult> {
    interface SearchResponse {
      results: Array<{
        id: number;
        title: string;
        original_title: string;
        release_date?: string;
        poster_path?: string | null;
        backdrop_path?: string | null;
        overview?: string;
        popularity?: number;
        vote_average?: number;
        vote_count?: number;
      }>;
    }

    // Step 1: Exact search with year
    let results: SearchResponse['results'] = [];
    if (year) {
      try {
        const res = await this.fetchJson<SearchResponse>('/search/movie', {
          query: name,
          year: year,
          include_adult: false,
          language: 'en-US'
        });
        results = res.results || [];
      } catch {
        results = [];
      }
    }

    // Step 2: Fallback to primary_release_year if 0 results
    if (results.length === 0 && year) {
      try {
        const res = await this.fetchJson<SearchResponse>('/search/movie', {
          query: name,
          primary_release_year: year,
          include_adult: false,
          language: 'en-US'
        });
        results = res.results || [];
      } catch {
        results = [];
      }
    }

    // Step 3: Fallback without year restriction (gets broader candidates for scoring)
    if (results.length === 0) {
      try {
        const res = await this.fetchJson<SearchResponse>('/search/movie', {
          query: name,
          include_adult: false,
          language: 'en-US'
        });
        results = res.results || [];
      } catch {
        results = [];
      }
    }

    if (results.length === 0) {
      return { status: 'unmatched' };
    }

    // Convert and score all candidates
    const candidates: TmdbMatchCandidate[] = results.slice(0, 10).map((r) => {
      const candYear = r.release_date ? parseInt(r.release_date.slice(0, 4), 10) : undefined;
      const score = scoreCandidate(
        name,
        year,
        r.title,
        r.original_title,
        candYear,
        r.popularity || 0
      );
      return {
        id: r.id,
        title: r.title,
        originalTitle: r.original_title,
        releaseDate: r.release_date,
        year: candYear,
        posterPath: r.poster_path,
        backdropPath: r.backdrop_path,
        overview: r.overview,
        popularity: r.popularity,
        voteAverage: r.vote_average,
        voteCount: r.vote_count,
        confidenceScore: score
      };
    });

    const classification = classifyCandidates(candidates);

    return {
      status: classification.status,
      tmdbId: classification.topCandidate?.id,
      score: classification.topCandidate?.confidenceScore,
      candidates
    };
  }

  /**
   * Enriches a movie by TMDb ID with compact metadata (Tier 1).
   */
  public async enrichMovie(tmdbId: number): Promise<TmdbMovieCompact> {
    if (this.movieMemoryCache.has(tmdbId)) {
      return this.movieMemoryCache.get(tmdbId)!;
    }

    if (this.inFlightEnrichments.has(tmdbId)) {
      return this.inFlightEnrichments.get(tmdbId)!;
    }

    const enrichPromise = this.performEnrichment(tmdbId);
    this.inFlightEnrichments.set(tmdbId, enrichPromise);

    try {
      const result = await enrichPromise;
      this.movieMemoryCache.set(tmdbId, result);
      return result;
    } finally {
      this.inFlightEnrichments.delete(tmdbId);
    }
  }

  private async performEnrichment(tmdbId: number): Promise<TmdbMovieCompact> {
    interface RawMovieResponse {
      id: number;
      title: string;
      original_title: string;
      release_date: string;
      runtime: number | null;
      genres: Array<{ id: number; name: string }>;
      original_language: string;
      spoken_languages: Array<{ iso_639_1: string; name: string }>;
      production_countries: Array<{ iso_3166_1: string; name: string }>;
      production_companies: Array<{ id: number; name: string }>;
      belongs_to_collection?: { id: number; name: string; poster_path?: string; backdrop_path?: string } | null;
      vote_average: number;
      vote_count: number;
      popularity: number;
      budget: number;
      revenue: number;
      poster_path?: string | null;
      backdrop_path?: string | null;
      release_dates?: {
        results: Array<{
          iso_3166_1: string;
          release_dates: Array<{ certification: string; type: number; release_date: string }>;
        }>;
      };
      keywords?: {
        keywords?: Array<{ id: number; name: string }>;
      };
      credits?: {
        cast: Array<{
          id: number;
          name: string;
          character: string;
          profile_path?: string | null;
          order: number;
          gender?: number;
        }>;
        crew: Array<{
          id: number;
          name: string;
          job: string;
          department: string;
          profile_path?: string | null;
          gender?: number;
        }>;
      };
    }

    const data = await this.fetchJson<RawMovieResponse>(`/movie/${tmdbId}`, {
      append_to_response: 'credits,keywords,release_dates,external_ids',
      language: 'en-US'
    });

    const releaseYear = data.release_date
      ? parseInt(data.release_date.slice(0, 4), 10) || 0
      : 0;

    // US Certification extraction
    let certification = 'NR';
    const usReleases = data.release_dates?.results?.find((r) => r.iso_3166_1 === 'US');
    if (usReleases && usReleases.release_dates.length > 0) {
      const withCert = usReleases.release_dates.find((d) => Boolean(d.certification));
      if (withCert) {
        certification = withCert.certification;
      }
    }

    // Compact cast (top 15)
    const cast: TmdbPersonCompact[] = (data.credits?.cast || []).slice(0, 15).map((c) => ({
      id: c.id,
      name: c.name,
      character: c.character,
      profilePath: c.profile_path,
      order: c.order,
      gender: c.gender
    }));

    // Crew categorisation
    const crew = data.credits?.crew || [];
    const directors: TmdbPersonCompact[] = crew
      .filter((c) => c.job === 'Director')
      .map((c) => ({ id: c.id, name: c.name, job: c.job, profilePath: c.profile_path, gender: c.gender }));

    const writers: TmdbPersonCompact[] = crew
      .filter((c) => c.job === 'Screenplay' || c.job === 'Writer' || c.department === 'Writing')
      .slice(0, 5)
      .map((c) => ({ id: c.id, name: c.name, job: c.job, profilePath: c.profile_path, gender: c.gender }));

    const cinematographers: TmdbPersonCompact[] = crew
      .filter((c) => c.job === 'Director of Photography' || c.job === 'Cinematographer')
      .slice(0, 3)
      .map((c) => ({ id: c.id, name: c.name, job: c.job, profilePath: c.profile_path, gender: c.gender }));

    const composers: TmdbPersonCompact[] = crew
      .filter((c) => c.job === 'Original Music Composer' || c.job === 'Music')
      .slice(0, 3)
      .map((c) => ({ id: c.id, name: c.name, job: c.job, profilePath: c.profile_path, gender: c.gender }));

    const editors: TmdbPersonCompact[] = crew
      .filter((c) => c.job === 'Editor')
      .slice(0, 3)
      .map((c) => ({ id: c.id, name: c.name, job: c.job, profilePath: c.profile_path, gender: c.gender }));

    const producers: TmdbPersonCompact[] = crew
      .filter((c) => c.job === 'Producer')
      .slice(0, 5)
      .map((c) => ({ id: c.id, name: c.name, job: c.job, profilePath: c.profile_path, gender: c.gender }));

    const keywords = (data.keywords?.keywords || []).map((k) => k.name);

    return {
      id: data.id,
      title: data.title,
      originalTitle: data.original_title,
      releaseDate: data.release_date || '',
      releaseYear,
      runtime: data.runtime || 0,
      genres: data.genres || [],
      originalLanguage: data.original_language || '',
      spokenLanguages: data.spoken_languages || [],
      productionCountries: data.production_countries || [],
      productionCompanies: data.production_companies || [],
      collection: data.belongs_to_collection
        ? {
            id: data.belongs_to_collection.id,
            name: data.belongs_to_collection.name,
            posterPath: data.belongs_to_collection.poster_path,
            backdropPath: data.belongs_to_collection.backdrop_path
          }
        : null,
      voteAverage: data.vote_average || 0,
      voteCount: data.vote_count || 0,
      popularity: data.popularity || 0,
      budget: data.budget || 0,
      revenue: data.revenue || 0,
      posterPath: data.poster_path,
      backdropPath: data.backdrop_path,
      certification,
      keywords,
      directors,
      cast,
      writers,
      cinematographers,
      composers,
      editors,
      producers,
      fetchedAt: Date.now()
    };
  }

  /**
   * Tier 2 Enrichment: Person filmography credits for completionist progress.
   */
  public async getPersonMovieCredits(personId: number): Promise<{ cast: Array<{ id: number; title: string }>; crew: Array<{ id: number; title: string; job: string }> }> {
    return this.fetchJson(`/person/${personId}/movie_credits`, { language: 'en-US' });
  }

  /**
   * Tier 2 Enrichment: Collection parts.
   */
  public async getCollectionDetails(collectionId: number): Promise<{ id: number; name: string; parts: Array<{ id: number; title: string; release_date?: string }> }> {
    return this.fetchJson(`/collection/${collectionId}`, { language: 'en-US' });
  }
}

export const tmdbClient = new TmdbClient();
