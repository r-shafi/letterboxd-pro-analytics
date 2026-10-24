/**
 * Ingestion State Store (Zustand)
 * Manages parsing, matching, live enrichment progress, overrides,
 * incremental storage persistence, rescoring migration, and review modal orchestration.
 */

import { create } from 'zustand';
import {
  Film,
  Entry,
  FilmList,
  Profile,
  ImportReport,
  TmdbMatchCandidate,
  TmdbMatchResult
} from '../types/domain.ts';
import { parseLetterboxdZip, parseLetterboxdCsvFiles } from '../services/parser/ingestionService.ts';
import { tmdbClient } from '../services/tmdb/client.ts';
import { storage } from '../utils/storage.ts';
import { MATCH_RULES_VERSION, rescoreFilmMatch } from '../services/tmdb/matching.ts';

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
  activeImportId?: string;

  // Review modal auto-open & persistent chip indicators
  autoOpenReviewModal: boolean;
  allMatchedToast: boolean;
  reviewNeededCount: number;

  // Actions
  importZip: (file: File | ArrayBuffer) => Promise<void>;
  importCsvs: (files: Record<string, string>) => Promise<void>;
  startMatchingAndEnrichment: () => Promise<void>;
  enrichFilmsQueue: (filmsToEnrich: Film[]) => Promise<void>;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  overrideMatch: (uri: string, candidate: TmdbMatchCandidate) => Promise<void>;
  undoOverrideMatch: (uri: string, previousMatch: TmdbMatchResult) => Promise<void>;
  markAsUnmatched: (uri: string) => Promise<void>;
  acceptApproximateMatches: () => Promise<number>;
  dismissReviewPrompt: () => void;
  clearAllMatchedToast: () => void;
  hydrateFromStorage: () => Promise<boolean>;
  loadDemoData: () => Promise<void>;
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
  activeImportId: undefined,
  autoOpenReviewModal: false,
  allMatchedToast: false,
  reviewNeededCount: 0,

  importZip: async (file) => {
    const importId = `import_${Date.now()}`;
    set({
      status: 'parsing',
      error: undefined,
      activeImportId: importId,
      autoOpenReviewModal: false,
      allMatchedToast: false,
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

      // Persist raw parsed data immediately using incremental storage
      await storage.setItem('data:films', parsed.films);
      await storage.setItem('data:entries', parsed.entries);
      await storage.setItem('data:lists', parsed.lists);
      if (parsed.profile) await storage.setItem('data:profile', parsed.profile);
      if (parsed.report) await storage.setItem('data:report', parsed.report);
      await storage.setItem('data:activeImportId', importId);

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
    const importId = `import_${Date.now()}`;
    set({
      status: 'parsing',
      error: undefined,
      activeImportId: importId,
      autoOpenReviewModal: false,
      allMatchedToast: false,
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
      await storage.setItem('data:activeImportId', importId);

      get().startMatchingAndEnrichment();
    } catch (err: unknown) {
      set({
        status: 'error',
        error: err instanceof Error ? err.message : 'Failed to parse CSV files'
      });
    }
  },

  startMatchingAndEnrichment: async () => {
    const { films, activeImportId } = get();
    const filmList = Object.values(films);
    if (filmList.length === 0) return;

    const importId = activeImportId || `import_${Date.now()}`;
    const total = filmList.length;

    // ==========================================
    // STAGE 1: MATCHING PHASE (Fast, Decoupled)
    // ==========================================
    const unmatchedFilms = filmList.filter((f) => f.match.status === 'unmatched');

    if (unmatchedFilms.length > 0) {
      set({ status: 'matching' });
      const matchQueue = [...unmatchedFilms];
      const MATCH_CONCURRENCY = 10;
      let matchedCount = total - unmatchedFilms.length;
      const startTime = Date.now();
      let lastStateUpdate = 0;

      const matchWorker = async () => {
        while (matchQueue.length > 0) {
          if (get().status === 'paused' || get().status === 'idle') break;
          const film = matchQueue.shift();
          if (!film) break;

          try {
            const matchResult = await tmdbClient.matchFilm(film.name, film.year);
            film.match = matchResult;
            storage.queueDirtyFilm(film);
          } catch {
            // lookup failure
          }

          matchedCount++;
          const now = Date.now();
          const elapsedSec = (now - startTime) / 1000;
          const speed = elapsedSec > 0 ? (matchedCount - (total - unmatchedFilms.length)) / elapsedSec : 0;
          const remaining = total - matchedCount;
          const etaSeconds = speed > 0 ? Math.round(remaining / speed) : 0;

          if (now - lastStateUpdate > 80 || matchedCount === total) {
            lastStateUpdate = now;
            set((state) => ({
              films: { ...state.films, [film.letterboxdUri]: { ...film } },
              progress: {
                phaseText: `Matching films with TMDb (${matchedCount}/${total})...`,
                total,
                current: matchedCount,
                percent: Math.round((matchedCount / total) * 100),
                speed: Math.round(speed * 10) / 10,
                etaSeconds
              }
            }));
          } else {
            get().films[film.letterboxdUri] = { ...film };
          }
        }
      };

      const matchPromises = Array.from(
        { length: Math.min(MATCH_CONCURRENCY, matchQueue.length) },
        () => matchWorker()
      );
      await Promise.all(matchPromises);

      // Flush dirty matched films to storage
      await storage.flushDirtyFilms();
    }

    if (get().status === 'paused' || get().status === 'idle') {
      return;
    }

    // ==========================================
    // STAGE 1 COMPLETE: CHECK FOR REVIEW QUEUE
    // ==========================================
    const currentFilms = Object.values(get().films);
    const reviewable = currentFilms.filter(
      (f) => f.match.status === 'ambiguous' || (f.match.status === 'unmatched' && !f.metadata)
    );
    const reviewCount = reviewable.length;

    let alreadyPrompted = false;
    try {
      alreadyPrompted = Boolean(localStorage.getItem(`lb_review_prompt_shown_${importId}`));
    } catch {}

    set({
      reviewNeededCount: reviewCount,
      autoOpenReviewModal: reviewCount > 0 && !alreadyPrompted,
      allMatchedToast: reviewCount === 0
    });

    // ==========================================
    // STAGE 2: ENRICHMENT PHASE (Background)
    // ==========================================
    set({ status: 'enriching' });
    const filmsToEnrich = currentFilms.filter(
      (f) => f.match.status === 'confident' && f.match.tmdbId && !f.metadata
    );

    if (filmsToEnrich.length > 0) {
      await get().enrichFilmsQueue(filmsToEnrich);
    }

    if (get().status === 'paused' || get().status === 'idle') {
      return;
    }

    // Finalize
    await storage.flushDirtyFilms();
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

  enrichFilmsQueue: async (filmsToEnrich: Film[]) => {
    const queue = [...filmsToEnrich];
    const ENRICH_CONCURRENCY = 8;
    const totalEnrich = queue.length;
    let enrichedCount = 0;
    const startTime = Date.now();
    let lastStateUpdate = 0;

    const worker = async () => {
      while (queue.length > 0) {
        if (get().status === 'paused' || get().status === 'idle') break;
        const film = queue.shift();
        if (!film || !film.match.tmdbId) break;

        try {
          const meta = await tmdbClient.enrichMovie(film.match.tmdbId);
          film.metadata = meta;
          storage.queueDirtyFilm(film);
        } catch {
          // ignore single failure
        }

        enrichedCount++;
        const now = Date.now();
        const elapsedSec = (now - startTime) / 1000;
        const speed = elapsedSec > 0 ? enrichedCount / elapsedSec : 0;
        const remaining = totalEnrich - enrichedCount;
        const etaSeconds = speed > 0 ? Math.round(remaining / speed) : 0;

        if (now - lastStateUpdate > 100 || enrichedCount === totalEnrich) {
          lastStateUpdate = now;
          set((state) => ({
            films: { ...state.films, [film.letterboxdUri]: { ...film } },
            progress: {
              phaseText: `Enriching film details (${enrichedCount}/${totalEnrich})...`,
              total: totalEnrich,
              current: enrichedCount,
              percent: Math.round((enrichedCount / totalEnrich) * 100),
              speed: Math.round(speed * 10) / 10,
              etaSeconds
            }
          }));
        } else {
          get().films[film.letterboxdUri] = { ...film };
        }
      }
    };

    const promises = Array.from(
      { length: Math.min(ENRICH_CONCURRENCY, queue.length) },
      () => worker()
    );
    await Promise.all(promises);
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
      manuallyOverridden: true,
      matchRulesVersion: MATCH_RULES_VERSION
    };

    // Update in-memory state immediately (< 1 ms, off critical path)
    storage.queueDirtyFilm(film);
    set((state) => {
      const updated = { ...state.films, [uri]: { ...film } };
      const remainingReview = Object.values(updated).filter(
        (f) => f.match.status === 'ambiguous' || (f.match.status === 'unmatched' && !f.metadata)
      ).length;
      return {
        films: updated,
        reviewNeededCount: remainingReview
      };
    });

    // Background enrichment without blocking UI advance
    tmdbClient
      .enrichMovie(candidate.id)
      .then((meta) => {
        const current = get().films[uri];
        if (current && current.match.tmdbId === candidate.id) {
          current.metadata = meta;
          storage.queueDirtyFilm(current);
        }
      })
      .catch(() => {});
  },

  undoOverrideMatch: async (uri: string, previousMatch: TmdbMatchResult) => {
    const { films } = get();
    const film = films[uri];
    if (!film) return;

    film.match = previousMatch;
    storage.queueDirtyFilm(film);

    set((state) => {
      const updated = { ...state.films, [uri]: { ...film } };
      const remainingReview = Object.values(updated).filter(
        (f) => f.match.status === 'ambiguous' || (f.match.status === 'unmatched' && !f.metadata)
      ).length;
      return {
        films: updated,
        reviewNeededCount: remainingReview
      };
    });
  },

  markAsUnmatched: async (uri: string) => {
    const { films } = get();
    const film = films[uri];
    if (!film) return;

    film.match = {
      status: 'unmatched',
      reason: 'unmatched',
      candidates: film.match.candidates,
      manuallyOverridden: true,
      matchRulesVersion: MATCH_RULES_VERSION
    };
    storage.queueDirtyFilm(film);

    set((state) => {
      const updated = { ...state.films, [uri]: { ...film } };
      const remainingReview = Object.values(updated).filter(
        (f) => f.match.status === 'ambiguous' || (f.match.status === 'unmatched' && !f.metadata)
      ).length;
      return {
        films: updated,
        reviewNeededCount: remainingReview
      };
    });
  },

  acceptApproximateMatches: async (): Promise<number> => {
    const { films } = get();
    const approximateFilms = Object.values(films).filter(
      (f) =>
        !f.match.manuallyOverridden &&
        (f.match.reason === 'approximate_year' || f.match.approximateYear === true) &&
        f.match.candidates &&
        f.match.candidates.length > 0
    );

    let accepted = 0;
    const toEnrich: Film[] = [];

    approximateFilms.forEach((film) => {
      const cand = film.match.candidates![0];
      film.match = {
        status: 'confident',
        tmdbId: cand.id,
        score: cand.confidenceScore,
        candidates: film.match.candidates,
        reason: 'approximate_year',
        approximateYear: true,
        matchRulesVersion: MATCH_RULES_VERSION
      };
      storage.queueDirtyFilm(film);
      if (!film.metadata && cand.id) {
        toEnrich.push(film);
      }
      accepted++;
    });

    if (accepted > 0) {
      await storage.flushDirtyFilms();
      set((state) => {
        const remaining = Object.values(state.films).filter(
          (f) => f.match.status === 'ambiguous' || (f.match.status === 'unmatched' && !f.metadata)
        ).length;
        return {
          films: { ...state.films },
          reviewNeededCount: remaining
        };
      });

      if (toEnrich.length > 0) {
        get().enrichFilmsQueue(toEnrich).catch(() => {});
      }
    }

    return accepted;
  },

  dismissReviewPrompt: () => {
    const { activeImportId } = get();
    if (activeImportId) {
      try {
        localStorage.setItem(`lb_review_prompt_shown_${activeImportId}`, 'true');
      } catch {}
    }
    set({ autoOpenReviewModal: false });
  },

  clearAllMatchedToast: () => {
    set({ allMatchedToast: false });
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
      const storedImportId = (await storage.getItem<string>('data:activeImportId')) || undefined;

      await tmdbClient.hydrateCaches();

      // ==========================================
      // RESCORING MIGRATION: Upgrades old matches
      // ==========================================
      let hasRescoredChanges = false;
      const newlyConfidentFilms: Film[] = [];

      for (const film of Object.values(storedFilms)) {
        if (
          !film.match.manuallyOverridden &&
          (film.match.status === 'ambiguous' || film.match.status === 'unmatched')
        ) {
          if ((film.match.matchRulesVersion || 1) < MATCH_RULES_VERSION) {
            const rescored = rescoreFilmMatch(film);
            if (rescored.status !== film.match.status || rescored.reason !== film.match.reason) {
              film.match = rescored;
              hasRescoredChanges = true;
              if (rescored.status === 'confident' && rescored.tmdbId && !film.metadata) {
                newlyConfidentFilms.push(film);
              }
            }
          }
        }
      }

      if (hasRescoredChanges) {
        await storage.setItem('data:films', storedFilms);
        if (newlyConfidentFilms.length > 0) {
          setTimeout(() => {
            get().enrichFilmsQueue(newlyConfidentFilms).catch(() => {});
          }, 100);
        }
      }

      const reviewCount = Object.values(storedFilms).filter(
        (f) => f.match.status === 'ambiguous' || (f.match.status === 'unmatched' && !f.metadata)
      ).length;

      set({
        films: storedFilms,
        entries: storedEntries,
        lists: storedLists,
        profile: storedProfile,
        report: storedReport,
        activeImportId: storedImportId,
        reviewNeededCount: reviewCount,
        status: 'completed'
      });

      return true;
    } catch {
      return false;
    }
  },

  loadDemoData: async () => {
    const importId = 'import_demo';
    set({
      status: 'parsing',
      error: undefined,
      activeImportId: importId,
      progress: {
        phaseText: 'Loading demo archive...',
        total: 100,
        current: 50,
        percent: 50,
        speed: 0,
        etaSeconds: 0
      }
    });

    const { generateDemoDataset } = await import('../services/synthetic/demoLoader.ts');
    const demo = generateDemoDataset(120);

    await storage.setItem('data:films', demo.films);
    await storage.setItem('data:entries', demo.entries);
    await storage.setItem('data:lists', demo.lists);
    if (demo.profile) await storage.setItem('data:profile', demo.profile);
    if (demo.report) await storage.setItem('data:report', demo.report);
    await storage.setItem('data:activeImportId', importId);

    // Demo data has zero ambiguous review items
    set({
      films: demo.films,
      entries: demo.entries,
      lists: demo.lists,
      profile: demo.profile,
      report: demo.report,
      activeImportId: importId,
      autoOpenReviewModal: false,
      reviewNeededCount: 0,
      status: 'completed',
      progress: {
        phaseText: 'Demo dataset ready',
        total: Object.keys(demo.films).length,
        current: Object.keys(demo.films).length,
        percent: 100,
        speed: 0,
        etaSeconds: 0
      }
    });
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
      activeImportId: undefined,
      autoOpenReviewModal: false,
      allMatchedToast: false,
      reviewNeededCount: 0,
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

if (typeof window !== 'undefined') {
  (window as unknown as { useIngestionStore?: typeof useIngestionStore }).useIngestionStore = useIngestionStore;
}
