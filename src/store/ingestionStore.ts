/**
 * Ingestion State Store (Zustand)
 * Manages parsing, matching, live enrichment progress, overrides, and storage persistence.
 */

import { create } from 'zustand';
import {
  Film,
  Entry,
  FilmList,
  Profile,
  ImportReport,
  TmdbMatchCandidate
} from '../types/domain.ts';
import { parseLetterboxdZip, parseLetterboxdCsvFiles } from '../services/parser/ingestionService.ts';
import { tmdbClient } from '../services/tmdb/client.ts';
import { storage } from '../utils/storage.ts';

export type IngestionPhase =
  | 'idle'
  | 'parsing'
  | 'matching'
  | 'enriching'
  | 'completed'
  | 'paused'
  | 'error';

export interface IngestionProgress {
  phaseText: string;
  total: number;
  current: number;
  percent: number;
  speed: number; // items per sec
  etaSeconds: number;
}

export interface IngestionStore {
  status: IngestionPhase;
  error?: string;
  films: Record<string, Film>;
  entries: Entry[];
  lists: FilmList[];
  profile?: Profile;
  report?: ImportReport;
  progress: IngestionProgress;

  // Actions
  importZip: (file: File | ArrayBuffer) => Promise<void>;
  importCsvs: (files: Record<string, string>) => Promise<void>;
  startMatchingAndEnrichment: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  overrideMatch: (uri: string, candidate: TmdbMatchCandidate) => Promise<void>;
  hydrateFromStorage: () => Promise<boolean>;
  clearAllData: () => Promise<void>;
}

export const useIngestionStore = create<IngestionStore>((set, get) => ({
  status: 'idle',
  films: {},
  entries: [],
  lists: [],
  profile: undefined,
  report: undefined,
  progress: {
    phaseText: '',
    total: 0,
    current: 0,
    percent: 0,
    speed: 0,
    etaSeconds: 0
  },

  importZip: async (file) => {
    set({
      status: 'parsing',
      error: undefined,
      progress: {
        phaseText: 'Decompressing and parsing archive...',
        total: 100,
        current: 10,
        percent: 10,
        speed: 0,
        etaSeconds: 0
      }
    });

    try {
      const parsed = await parseLetterboxdZip(file, (stage, percent) => {
        set((state) => ({
          progress: { ...state.progress, phaseText: stage, percent, current: percent }
        }));
      });

      set({
        films: parsed.films,
        entries: parsed.entries,
        lists: parsed.lists,
        profile: parsed.profile,
        report: parsed.report,
        status: 'idle'
      });

      // Persist raw parsed data immediately
      await storage.setItem('data:films', parsed.films);
      await storage.setItem('data:entries', parsed.entries);
      await storage.setItem('data:lists', parsed.lists);
      if (parsed.profile) await storage.setItem('data:profile', parsed.profile);
      if (parsed.report) await storage.setItem('data:report', parsed.report);

      // Auto start matching
      get().startMatchingAndEnrichment();
    } catch (err: unknown) {
      set({
        status: 'error',
        error: err instanceof Error ? err.message : 'Failed to parse export archive'
      });
    }
  },

  importCsvs: async (files) => {
    set({
      status: 'parsing',
      error: undefined,
      progress: {
        phaseText: 'Parsing CSV files...',
        total: 100,
        current: 20,
        percent: 20,
        speed: 0,
        etaSeconds: 0
      }
    });

    try {
      const parsed = await parseLetterboxdCsvFiles(files);
      set({
        films: parsed.films,
        entries: parsed.entries,
        lists: parsed.lists,
        profile: parsed.profile,
        report: parsed.report,
        status: 'idle'
      });

      await storage.setItem('data:films', parsed.films);
      await storage.setItem('data:entries', parsed.entries);
      await storage.setItem('data:lists', parsed.lists);
      if (parsed.profile) await storage.setItem('data:profile', parsed.profile);
      if (parsed.report) await storage.setItem('data:report', parsed.report);

      get().startMatchingAndEnrichment();
    } catch (err: unknown) {
      set({
        status: 'error',
        error: err instanceof Error ? err.message : 'Failed to parse CSV files'
      });
    }
  },

  startMatchingAndEnrichment: async () => {
    const { films } = get();
    const filmList = Object.values(films);
    if (filmList.length === 0) return;

    set({ status: 'matching' });
    const startTime = Date.now();
    let completedCount = 0;
    const total = filmList.length;

    // Filter films that still need matching
    const filmsToMatch = filmList.filter((f) => f.match.status === 'unmatched' && !f.metadata);

    // 1. Matching phase
    for (const film of filmsToMatch) {
      if (get().status === 'paused' || get().status === 'idle') break;

      try {
        const matchResult = await tmdbClient.matchFilm(film.name, film.year);
        film.match = matchResult;

        // If confident match, immediately queue Tier-1 enrichment
        if (matchResult.status === 'confident' && matchResult.tmdbId) {
          const meta = await tmdbClient.enrichMovie(matchResult.tmdbId);
          film.metadata = meta;
        }
      } catch {
        // Continue despite single film lookup failure
      }

      completedCount++;
      const elapsedSec = (Date.now() - startTime) / 1000;
      const speed = elapsedSec > 0 ? completedCount / elapsedSec : 0;
      const remaining = total - completedCount;
      const etaSeconds = speed > 0 ? Math.round(remaining / speed) : 0;

      // Update progress
      set((state) => ({
        films: { ...state.films, [film.letterboxdUri]: { ...film } },
        progress: {
          phaseText: `Matching films (${completedCount}/${total})...`,
          total,
          current: completedCount,
          percent: Math.round((completedCount / total) * 100),
          speed: Math.round(speed * 10) / 10,
          etaSeconds
        }
      }));
    }

    // Persist final matched state and caches
    await storage.setItem('data:films', get().films);
    await tmdbClient.persistCaches();

    set({
      status: 'completed',
      progress: {
        phaseText: 'Import and enrichment complete!',
        total,
        current: total,
        percent: 100,
        speed: 0,
        etaSeconds: 0
      }
    });
  },

  pause: () => {
    tmdbClient.getLimiter().pause();
    set({ status: 'paused' });
  },

  resume: () => {
    tmdbClient.getLimiter().resume();
    set({ status: 'matching' });
    get().startMatchingAndEnrichment();
  },

  cancel: () => {
    tmdbClient.getLimiter().cancel();
    set({ status: 'idle' });
  },

  overrideMatch: async (uri: string, candidate: TmdbMatchCandidate) => {
    const { films } = get();
    const film = films[uri];
    if (!film) return;

    film.match = {
      status: 'confident',
      tmdbId: candidate.id,
      score: 1.0,
      candidates: [candidate],
      manuallyOverridden: true
    };

    // Enrich with new TMDb ID
    try {
      const meta = await tmdbClient.enrichMovie(candidate.id);
      film.metadata = meta;
    } catch {
      // Ignore
    }

    set((state) => ({
      films: { ...state.films, [uri]: { ...film } }
    }));

    await storage.setItem('data:films', get().films);
    await tmdbClient.persistCaches();
  },

  hydrateFromStorage: async () => {
    try {
      const storedFilms = await storage.getItem<Record<string, Film>>('data:films');
      if (!storedFilms || Object.keys(storedFilms).length === 0) {
        return false;
      }

      const storedEntries = (await storage.getItem<Entry[]>('data:entries')) || [];
      const storedLists = (await storage.getItem<FilmList[]>('data:lists')) || [];
      const storedProfile = (await storage.getItem<Profile>('data:profile')) || undefined;
      const storedReport = (await storage.getItem<ImportReport>('data:report')) || undefined;

      await tmdbClient.hydrateCaches();

      set({
        films: storedFilms,
        entries: storedEntries,
        lists: storedLists,
        profile: storedProfile,
        report: storedReport,
        status: 'completed'
      });

      return true;
    } catch {
      return false;
    }
  },

  clearAllData: async () => {
    await storage.clearAllData();
    set({
      status: 'idle',
      films: {},
      entries: [],
      lists: [],
      profile: undefined,
      report: undefined,
      error: undefined,
      progress: {
        phaseText: '',
        total: 0,
        current: 0,
        percent: 0,
        speed: 0,
        etaSeconds: 0
      }
    });
  }
}));
