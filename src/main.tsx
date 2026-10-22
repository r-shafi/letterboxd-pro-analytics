import React, { StrictMode, useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { Header } from './components/layout/Header.tsx';
import { Footer } from './components/layout/Footer.tsx';
import { Dropzone } from './components/ingestion/Dropzone.tsx';
import { ProgressBar } from './components/ingestion/ProgressBar.tsx';
import { ControlBar } from './components/dashboard/ControlBar.tsx';
import { ScrollSpyNav } from './components/dashboard/ScrollSpyNav.tsx';
import { FilmDrawer } from './components/dashboard/FilmDrawer.tsx';
import { ShareCardModal } from './components/dashboard/ShareCardModal.tsx';
import { DataQualityModal } from './components/ingestion/DataQualityModal.tsx';
import { ReviewMatchesModal } from './components/ingestion/ReviewMatchesModal.tsx';
import { SettingsModal } from './components/modals/SettingsModal.tsx';
import { PrivacyModal } from './components/modals/PrivacyModal.tsx';
import { tracker, getFilmCountBucket } from './services/telemetry/tracker.ts';

import { S1SnapshotSection } from './components/sections/S1SnapshotSection.tsx';
import { S2IdentitySection } from './components/sections/S2IdentitySection.tsx';
import { S3VolumeSection } from './components/sections/S3VolumeSection.tsx';
import { S4RatingsSection } from './components/sections/S4RatingsSection.tsx';
import { S5CrowdSection } from './components/sections/S5CrowdSection.tsx';
import { S6TasteSection } from './components/sections/S6TasteSection.tsx';
import { S7PeopleSection } from './components/sections/S7PeopleSection.tsx';
import { S8WorldSection } from './components/sections/S8WorldSection.tsx';
import { S9GenresDecadesSection } from './components/sections/S9GenresDecadesSection.tsx';
import { S10RewatchesSection } from './components/sections/S10RewatchesSection.tsx';
import { S11WordsTagsSection } from './components/sections/S11WordsTagsSection.tsx';
import { S12WatchlistSection } from './components/sections/S12WatchlistSection.tsx';
import { S13RecordsSection } from './components/sections/S13RecordsSection.tsx';
import { S14ShareSection } from './components/sections/S14ShareSection.tsx';

import { useIngestionStore } from './store/ingestionStore.ts';
import { calculateAnalyticsSnapshot } from './services/analytics/engine.ts';
import { TimeFilter, HeatmapDayCell, RankedPerson, AnalyticsSnapshot } from './services/analytics/types.ts';
import { Film, Profile } from './types/domain.ts';
import { decompressSharedSnapshotAsync, sharedPayloadToSnapshot } from './services/share/urlShare.ts';
import './index.css';

export const App: React.FC = () => {
  const store = useIngestionStore();
  const [filter, setFilter] = useState<TimeFilter>({ range: 'all' });
  const [sharedViewData, setSharedViewData] = useState<{
    snapshot: AnalyticsSnapshot;
    profile: Profile;
    films: Record<string, Film>;
  } | null>(null);

  // Modal states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isQualityOpen, setIsQualityOpen] = useState(false);
  const [isReviewMatchesOpen, setIsReviewMatchesOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Drawer state for drill-down
  const [drawerState, setDrawerState] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    filmKeys: string[];
  }>({
    isOpen: false,
    title: '',
    subtitle: undefined,
    filmKeys: []
  });

  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  }

  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  // Hydrate on mount & track pageview / PWA install event
  useEffect(() => {
    store.hydrateFromStorage();
    tracker.track({ name: 'pageview', properties: { path: window.location.pathname } });

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  // Check URL fragment for #v1= on mount and hashchange
  useEffect(() => {
    const checkHash = async () => {
      const hash = window.location.hash;
      if (hash.startsWith('#v1=') || hash.startsWith('v1=')) {
        const payload = await decompressSharedSnapshotAsync(hash);
        if (payload) {
          const adapted = sharedPayloadToSnapshot(payload);
          setSharedViewData(adapted);
          tracker.track({ name: 'pageview', properties: { path: window.location.pathname } });
        }
      } else {
        setSharedViewData(null);
      }
    };

    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  const handleInstallPwa = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === 'accepted') {
      tracker.track({ name: 'pwa_installed' });
    }
    setInstallPrompt(null);
  };

  useEffect(() => {
    if (store.status === 'completed' && Object.keys(store.films).length > 0) {
      const count = Object.keys(store.films).length;
      tracker.track({
        name: 'import_complete',
        properties: {
          filmCountBucket: getFilmCountBucket(count),
          durationSec: 1
        }
      });
    }
  }, [store.status]);

  // Compute analytics snapshot memoized on films, entries, filter
  const snapshot = useMemo(() => {
    return calculateAnalyticsSnapshot(
      store.films,
      store.entries,
      store.lists,
      store.profile,
      filter
    );
  }, [store.films, store.entries, store.lists, store.profile, filter]);

  const isSharedView = Boolean(sharedViewData);
  const activeFilms = sharedViewData ? sharedViewData.films : store.films;
  const activeProfile = sharedViewData ? sharedViewData.profile : store.profile;
  const activeSnapshot = sharedViewData ? sharedViewData.snapshot : snapshot;

  const hasData = Object.keys(activeFilms).length > 0;
  const isImporting =
    !isSharedView &&
    (store.status === 'parsing' ||
      store.status === 'matching' ||
      store.status === 'enriching' ||
      store.status === 'paused');

  // Available years for dropdown
  const availableYears = useMemo(() => {
    return activeSnapshot.s3Volume.yearlyVolume.map((y) => y.year);
  }, [activeSnapshot]);

  const matchedCount = useMemo(() => {
    return isSharedView
      ? activeSnapshot.s1Snapshot.totalFilms
      : Object.values(activeFilms).filter((f) => f.match.status === 'confident').length;
  }, [isSharedView, activeSnapshot, activeFilms]);

  // Drawer handlers
  const handleOpenFilmDetail = (filmKey: string) => {
    const film = activeFilms[filmKey];
    setDrawerState({
      isOpen: true,
      title: film?.name || 'Film Details',
      subtitle: film?.year ? `Released in ${film.year}` : undefined,
      filmKeys: [filmKey]
    });
  };

  const handleSelectDay = (cell: HeatmapDayCell) => {
    setDrawerState({
      isOpen: true,
      title: `Screenings on ${cell.date}`,
      subtitle: `${cell.count} ${cell.count === 1 ? 'film' : 'films'} logged on this calendar date`,
      filmKeys: cell.filmKeys
    });
  };

  const handleSelectMarathon = (day: { date: string; count: number; filmKeys: string[] }) => {
    setDrawerState({
      isOpen: true,
      title: `Marathon on ${day.date}`,
      subtitle: `${day.count} films watched in one day`,
      filmKeys: day.filmKeys
    });
  };

  const handleSelectRating = (rating: number) => {
    const matchingKeys = Object.values(activeFilms)
      .filter((f) => f.rating === rating)
      .map((f) => f.letterboxdUri);
    setDrawerState({
      isOpen: true,
      title: `${rating}★ Rated Films`,
      subtitle: `${matchingKeys.length} films with this exact rating`,
      filmKeys: matchingKeys
    });
  };

  const handleSelectPerson = (person: RankedPerson, role: string) => {
    const roleLabel = role === 'actresses' ? 'actress' : role.endsWith('s') ? role.slice(0, -1) : role;
    setDrawerState({
      isOpen: true,
      title: `${person.person.name}`,
      subtitle: `${person.count} ${roleLabel} credits in your library • ${person.avgRating}★ avg`,
      filmKeys: person.filmKeys
    });
  };

  const handleSelectGroup = (name: string, filmKeys: string[]) => {
    setDrawerState({
      isOpen: true,
      title: `${name} Cinema`,
      subtitle: `${filmKeys.length} films in this group`,
      filmKeys
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#14181c] text-[#ccdde6] selection:bg-[#00e054] selection:text-[#14181c]">
      {/* Sticky App Header */}
      <Header
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenPrivacy={() => setIsPrivacyOpen(true)}
        onOpenQualityModal={() => setIsQualityOpen(true)}
        onInstallPwa={handleInstallPwa}
        canInstallPwa={Boolean(installPrompt)}
        totalFilms={Object.keys(activeFilms).length}
        matchedCount={matchedCount}
      />

      {/* Read-Only Shared View Top Banner */}
      {isSharedView && (
        <div className="sticky top-14 z-40 flex flex-wrap items-center justify-between gap-3 border-b border-[#00e054]/30 bg-[#1b2026]/95 px-4 py-2.5 backdrop-blur-md sm:px-6">
          <div className="flex items-center space-x-2 text-xs text-[#ccdde6]">
            <span className="inline-block h-2 w-2 rounded-full bg-[#00e054] animate-pulse" />
            <span>
              Viewing shared stats from{' '}
              <strong className="text-white font-bold">@{activeProfile?.username || 'user'}</strong>
            </span>
          </div>

          <button
            onClick={() => {
              window.location.hash = '';
              setSharedViewData(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#00e054] px-3 py-1.5 text-xs font-bold text-[#14181c] shadow hover:bg-[#00c047] transition-all"
          >
            <span>Import your own Letterboxd export to analyze your library</span>
          </button>
        </div>
      )}

      {/* Global Control Bar when data exists */}
      {hasData && (
        <ControlBar
          filter={filter}
          onFilterChange={(nextFilter) => {
            setFilter(nextFilter);
            tracker.track({ name: 'filter_change', properties: { range: nextFilter.range } });
          }}
          availableYears={availableYears}
          totalFilms={activeSnapshot.s1Snapshot.totalFilms}
          dateUnknownCount={activeSnapshot.s1Snapshot.dateUnknownCount}
          matchedCount={matchedCount}
        />
      )}

      {/* Side-rail navigation for fast scrolling */}
      {hasData && <ScrollSpyNav />}

      <main className="flex-1 pb-24">
        {/* State 1: Empty / Landing Page */}
        {!hasData && !isImporting && (
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 space-y-12">
            <div className="text-center space-y-4 max-w-3xl mx-auto">
              <span className="rounded-full bg-[#00e054]/10 px-3 py-1 text-xs font-bold text-[#00e054] border border-[#00e054]/20 uppercase tracking-wider">
                100% Client-Side Film Analytics
              </span>
              <h1 className="font-display text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
                Pro-Level Analytics for Your Letterboxd Journey
              </h1>
              <p className="text-base text-[#99aabb] leading-relaxed">
                Import your official Letterboxd export. Discover your viewing velocity, director affinities, crowd contrarian index, and on-device rating predictions—without your data ever leaving your browser.
              </p>
            </div>

            {/* Dropzone Component */}
            <Dropzone
              onFileSelect={(file) => {
                tracker.track({ name: 'import_start', properties: { source: 'zip' } });
                store.importZip(file);
              }}
              onCsvFilesSelect={(files) => {
                tracker.track({ name: 'import_start', properties: { source: 'csv' } });
                store.importCsvs(files);
              }}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onLoadDemo={() => {
                tracker.track({ name: 'import_start', properties: { source: 'demo' } });
                store.loadDemoData();
              }}
            />
          </div>
        )}

        {/* State 2: Importing & Live Partial Dashboard */}
        {isImporting && (
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
            <ProgressBar
              status={store.status}
              progress={store.progress}
              onPause={store.pause}
              onResume={store.resume}
              onCancel={store.cancel}
            />

            {/* If files have been parsed, render progressive dashboard */}
            {hasData && (
              <div className="opacity-90 transition-opacity">
                <S1SnapshotSection
                  snapshot={activeSnapshot.s1Snapshot}
                  profile={activeProfile}
                  filmsRecord={activeFilms}
                  onSelectFilm={handleOpenFilmDetail}
                />
              </div>
            )}
          </div>
        )}

        {/* State 3: Full Narrative Dashboard (Single scrolling page S1 to S14) */}
        {hasData && !isImporting && (
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-20">
            <S1SnapshotSection
              snapshot={activeSnapshot.s1Snapshot}
              profile={activeProfile}
              filmsRecord={activeFilms}
              onSelectFilm={handleOpenFilmDetail}
            />

            <S2IdentitySection identity={activeSnapshot.s2Identity} />

            <S3VolumeSection
              volume={activeSnapshot.s3Volume}
              onSelectDay={handleSelectDay}
              onSelectMarathon={handleSelectMarathon}
            />

            <S4RatingsSection
              ratings={activeSnapshot.s4Ratings}
              onSelectRating={handleSelectRating}
              onSelectFilm={handleOpenFilmDetail}
            />

            <S5CrowdSection
              crowd={activeSnapshot.s5Crowd}
              onSelectFilm={handleOpenFilmDetail}
            />

            <S6TasteSection
              taste={activeSnapshot.s6Taste}
              overallMean={activeSnapshot.s1Snapshot.averageRating}
            />

            <S7PeopleSection
              people={activeSnapshot.s7People}
              overallMean={activeSnapshot.s1Snapshot.averageRating}
              onSelectPerson={handleSelectPerson}
            />

            <S8WorldSection
              world={activeSnapshot.s8World}
              onSelectGroup={handleSelectGroup}
            />

            <S9GenresDecadesSection
              genresDecades={activeSnapshot.s9Genres}
              onSelectFilm={handleOpenFilmDetail}
            />

            <S10RewatchesSection
              rewatches={activeSnapshot.s10Rewatches}
              onSelectFilm={handleOpenFilmDetail}
            />

            <S11WordsTagsSection wordsLists={activeSnapshot.s11WordsLists} />

            <S12WatchlistSection
              watchlist={activeSnapshot.s12Watchlist}
              onSelectFilm={handleOpenFilmDetail}
            />

            <S13RecordsSection
              records={activeSnapshot.s13Records}
              onSelectFilm={handleOpenFilmDetail}
            />

            <S14ShareSection
              snapshot={activeSnapshot}
              profile={activeProfile}
              onOpenShareModal={() => setIsShareModalOpen(true)}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <Footer onOpenPrivacy={() => setIsPrivacyOpen(true)} />

      {/* Modals & Overlays */}
      <FilmDrawer
        isOpen={drawerState.isOpen}
        title={drawerState.title}
        subtitle={drawerState.subtitle}
        filmKeys={drawerState.filmKeys}
        filmsRecord={activeFilms}
        onClose={() => setDrawerState((prev) => ({ ...prev, isOpen: false }))}
      />

      {isSettingsOpen && (
        <SettingsModal onClose={() => setIsSettingsOpen(false)} />
      )}

      {isQualityOpen && (
        <DataQualityModal
          report={store.report}
          films={activeFilms}
          onClose={() => setIsQualityOpen(false)}
          onOpenReviewMatches={() => setIsReviewMatchesOpen(true)}
          onClearData={store.clearAllData}
        />
      )}

      {isReviewMatchesOpen && (
        <ReviewMatchesModal
          films={activeFilms}
          onClose={() => setIsReviewMatchesOpen(false)}
          onOverrideMatch={store.overrideMatch}
        />
      )}

      {isShareModalOpen && (
        <ShareCardModal
          snapshot={activeSnapshot}
          profile={activeProfile}
          onClose={() => setIsShareModalOpen(false)}
        />
      )}

      {/* Privacy Guarantee & Legal Disclaimers Modal */}
      <PrivacyModal
        isOpen={isPrivacyOpen}
        onClose={() => setIsPrivacyOpen(false)}
      />
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
