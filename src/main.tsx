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
import { TimeFilter, HeatmapDayCell, RankedPerson } from './services/analytics/types.ts';
import './index.css';

export const App: React.FC = () => {
  const store = useIngestionStore();
  const [filter, setFilter] = useState<TimeFilter>({ range: 'all' });

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

  // Hydrate on mount
  useEffect(() => {
    store.hydrateFromStorage();
  }, []);

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

  const hasData = Object.keys(store.films).length > 0;
  const isImporting =
    store.status === 'parsing' ||
    store.status === 'matching' ||
    store.status === 'enriching' ||
    store.status === 'paused';

  // Available years for dropdown
  const availableYears = useMemo(() => {
    return snapshot.s3Volume.yearlyVolume.map((y) => y.year);
  }, [snapshot]);

  const matchedCount = useMemo(() => {
    return Object.values(store.films).filter((f) => f.match.status === 'confident').length;
  }, [store.films]);

  // Drawer handlers
  const handleOpenFilmDetail = (filmKey: string) => {
    const film = store.films[filmKey];
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
    const matchingKeys = Object.values(store.films)
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
    setDrawerState({
      isOpen: true,
      title: `${person.person.name}`,
      subtitle: `${person.count} ${role.slice(0, -1)} credits in your library • ${person.avgRating}★ avg`,
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
        onOpenQualityModal={() => setIsQualityOpen(true)}
        totalFilms={Object.keys(store.films).length}
        matchedCount={matchedCount}
      />

      {/* Global Control Bar when data exists */}
      {hasData && (
        <ControlBar
          filter={filter}
          onFilterChange={setFilter}
          availableYears={availableYears}
          totalFilms={snapshot.s1Snapshot.totalFilms}
          dateUnknownCount={snapshot.s1Snapshot.dateUnknownCount}
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
              onFileSelect={(file) => store.importZip(file)}
              onCsvFilesSelect={(files) => store.importCsvs(files)}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onLoadDemo={() => store.loadDemoData()}
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
                  snapshot={snapshot.s1Snapshot}
                  profile={store.profile}
                  filmsRecord={store.films}
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
              snapshot={snapshot.s1Snapshot}
              profile={store.profile}
              filmsRecord={store.films}
              onSelectFilm={handleOpenFilmDetail}
            />

            <S2IdentitySection identity={snapshot.s2Identity} />

            <S3VolumeSection
              volume={snapshot.s3Volume}
              onSelectDay={handleSelectDay}
              onSelectMarathon={handleSelectMarathon}
            />

            <S4RatingsSection
              ratings={snapshot.s4Ratings}
              onSelectRating={handleSelectRating}
              onSelectFilm={handleOpenFilmDetail}
            />

            <S5CrowdSection
              crowd={snapshot.s5Crowd}
              onSelectFilm={handleOpenFilmDetail}
            />

            <S6TasteSection
              taste={snapshot.s6Taste}
              overallMean={snapshot.s1Snapshot.averageRating}
            />

            <S7PeopleSection
              people={snapshot.s7People}
              overallMean={snapshot.s1Snapshot.averageRating}
              onSelectPerson={handleSelectPerson}
            />

            <S8WorldSection
              world={snapshot.s8World}
              onSelectGroup={handleSelectGroup}
            />

            <S9GenresDecadesSection
              genresDecades={snapshot.s9Genres}
              onSelectFilm={handleOpenFilmDetail}
            />

            <S10RewatchesSection
              rewatches={snapshot.s10Rewatches}
              onSelectFilm={handleOpenFilmDetail}
            />

            <S11WordsTagsSection wordsLists={snapshot.s11WordsLists} />

            <S12WatchlistSection
              watchlist={snapshot.s12Watchlist}
              onSelectFilm={handleOpenFilmDetail}
            />

            <S13RecordsSection
              records={snapshot.s13Records}
              onSelectFilm={handleOpenFilmDetail}
            />

            <S14ShareSection
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
        filmsRecord={store.films}
        onClose={() => setDrawerState((prev) => ({ ...prev, isOpen: false }))}
      />

      {isSettingsOpen && (
        <SettingsModal onClose={() => setIsSettingsOpen(false)} />
      )}

      {isQualityOpen && (
        <DataQualityModal
          report={store.report}
          films={store.films}
          onClose={() => setIsQualityOpen(false)}
          onOpenReviewMatches={() => setIsReviewMatchesOpen(true)}
          onClearData={store.clearAllData}
        />
      )}

      {isReviewMatchesOpen && (
        <ReviewMatchesModal
          films={store.films}
          onClose={() => setIsReviewMatchesOpen(false)}
          onOverrideMatch={store.overrideMatch}
        />
      )}

      {isShareModalOpen && (
        <ShareCardModal
          snapshot={snapshot}
          onClose={() => setIsShareModalOpen(false)}
        />
      )}

      {/* Privacy Guarantee Modal */}
      {isPrivacyOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg rounded-xl border border-[#2c3440] bg-[#1b2026] p-6 shadow-2xl space-y-4">
            <h3 className="font-display text-lg font-bold text-white">Privacy Guarantee</h3>
            <p className="text-xs text-[#ccdde6] leading-relaxed">
              <strong>Your film history is private:</strong>
            </p>
            <ul className="list-disc pl-5 text-xs text-[#99aabb] space-y-1.5">
              <li>Letterboxd zip archives and CSVs are parsed locally in your browser using a dedicated Web Worker.</li>
              <li>Your personal data (email, family name, private profile info) is immediately discarded upon parsing.</li>
              <li>Only public movie titles and release years are queried to TMDb for poster artwork and metadata lookups.</li>
              <li>All processed statistics are stored solely in your device&apos;s localStorage / IndexedDB.</li>
            </ul>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsPrivacyOpen(false)}
                className="rounded-lg bg-[#00e054] px-4 py-2 text-xs font-bold text-[#14181c] hover:bg-[#00c047]"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
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
