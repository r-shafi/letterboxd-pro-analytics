import React, { useState } from 'react';
import { Film, TmdbMatchCandidate } from '../../types/domain.ts';
import { Check, Search, X, AlertCircle } from 'lucide-react';
import { tmdbClient } from '../../services/tmdb/client.ts';
import { CONFIG } from '../../config/env.ts';
import { PosterImage } from '../common/PosterImage.tsx';

interface ReviewMatchesModalProps {
  films: Record<string, Film>;
  onClose: () => void;
  onOverrideMatch: (uri: string, candidate: TmdbMatchCandidate) => Promise<void>;
}

export const ReviewMatchesModal: React.FC<ReviewMatchesModalProps> = ({
  films,
  onClose,
  onOverrideMatch
}) => {
  // Find films that are ambiguous or unmatched
  const reviewableFilms = Object.values(films).filter(
    (f) => f.match.status === 'ambiguous' || (f.match.status === 'unmatched' && !f.metadata)
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [manualQuery, setManualQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<TmdbMatchCandidate[]>([]);

  const currentFilm = reviewableFilms[currentIndex];

  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualQuery.trim()) return;

    setIsSearching(true);
    try {
      const res = await tmdbClient.fetchJson<{
        results: Array<{
          id: number;
          title: string;
          original_title: string;
          release_date?: string;
          poster_path?: string | null;
          overview?: string;
          vote_average?: number;
          popularity?: number;
        }>;
      }>('/search/movie', {
        query: manualQuery.trim(),
        include_adult: false,
        language: 'en-US'
      });

      const candidates: TmdbMatchCandidate[] = (res.results || []).slice(0, 8).map((r) => ({
        id: r.id,
        title: r.title,
        originalTitle: r.original_title,
        releaseDate: r.release_date,
        year: r.release_date ? parseInt(r.release_date.slice(0, 4), 10) : undefined,
        posterPath: r.poster_path,
        overview: r.overview,
        confidenceScore: 1.0
      }));
      setSearchResults(candidates);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectCandidate = async (candidate: TmdbMatchCandidate) => {
    if (!currentFilm) return;
    await onOverrideMatch(currentFilm.letterboxdUri, candidate);
    setSearchResults([]);
    setManualQuery('');
    if (currentIndex < reviewableFilms.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  };

  const handleSkip = () => {
    setSearchResults([]);
    setManualQuery('');
    if (currentIndex < reviewableFilms.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  };

  if (!currentFilm || reviewableFilms.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
        <div className="w-full max-w-md rounded-xl border border-[#2c3440] bg-[#1b2026] p-6 text-center shadow-2xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#00e054]/10 text-[#00e054]">
            <Check className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-bold text-white">All Matches Reviewed</h3>
          <p className="mt-2 text-xs text-[#99aabb]">
            There are no ambiguous or unmatched films requiring review.
          </p>
          <button
            onClick={onClose}
            className="mt-6 rounded-lg bg-[#00e054] px-4 py-2 text-xs font-bold text-[#14181c] hover:bg-[#00c047]"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  const displayedCandidates =
    searchResults.length > 0 ? searchResults : currentFilm.match.candidates || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-[#2c3440] bg-[#1b2026] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2c3440] px-6 py-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-[#ff8000]" />
            <h3 className="text-base font-bold text-white">
              Review TMDb Match ({currentIndex + 1} of {reviewableFilms.length})
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-[#99aabb] hover:bg-[#2c3440] hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Target film in Letterboxd export */}
        <div className="border-b border-[#2c3440] bg-[#14181c] px-6 py-4">
          <div className="text-xs uppercase tracking-wider text-[#99aabb]">Letterboxd Item:</div>
          <div className="mt-1 flex items-baseline space-x-2">
            <span className="font-display text-lg font-bold text-white">{currentFilm.name}</span>
            {currentFilm.year && (
              <span className="text-sm font-medium text-[#99aabb]">({currentFilm.year})</span>
            )}
          </div>
          <div className="mt-1 font-mono text-[11px] text-[#99aabb]/60 truncate">
            {currentFilm.letterboxdUri}
          </div>
        </div>

        {/* Candidates list & manual search */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Manual search bar */}
          <form onSubmit={handleManualSearch} className="mb-4 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#99aabb]" />
              <input
                type="text"
                value={manualQuery}
                onChange={(e) => setManualQuery(e.target.value)}
                placeholder={`Search TMDb for "${currentFilm.name}"...`}
                className="w-full rounded-lg border border-[#2c3440] bg-[#14181c] py-2 pl-9 pr-3 text-xs text-white placeholder-[#99aabb]/60 focus:border-[#00e054] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching}
              className="rounded-lg bg-[#2c3440] px-4 py-2 text-xs font-semibold text-white hover:bg-[#3d4756] disabled:opacity-50"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </form>

          {/* Candidate cards */}
          <div className="space-y-3">
            {displayedCandidates.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#99aabb]">
                No candidates found. Use the search bar above to look up this title manually.
              </div>
            ) : (
              displayedCandidates.map((candidate) => (
                <div
                  key={candidate.id}
                  className="flex items-start justify-between rounded-lg border border-[#2c3440] bg-[#14181c] p-3 hover:border-[#00e054]/50 transition-colors"
                >
                  <div className="flex space-x-3">
                    <PosterImage
                      src={candidate.posterPath ? `${CONFIG.tmdbImageBase}/w92${candidate.posterPath}` : null}
                      alt={candidate.title}
                      className="h-16 w-11 rounded object-cover border border-[#2c3440] shrink-0"
                      fallbackIcon={
                        <div className="flex h-16 w-11 items-center justify-center rounded bg-[#222831] text-[10px] text-[#99aabb] text-center p-1">
                          No poster
                        </div>
                      }
                      loading="lazy"
                    />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold text-white">{candidate.title}</span>
                        {candidate.year && (
                          <span className="text-xs text-[#99aabb]">({candidate.year})</span>
                        )}
                        {candidate.confidenceScore > 0 && (
                          <span className="rounded bg-[#2c3440] px-1.5 py-0.5 text-[10px] font-mono text-[#00e054]">
                            Score: {Math.round(candidate.confidenceScore * 100)}%
                          </span>
                        )}
                      </div>
                      {candidate.overview && (
                        <p className="mt-1 line-clamp-2 text-xs text-[#99aabb] leading-relaxed">
                          {candidate.overview}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleSelectCandidate(candidate)}
                    className="ml-3 shrink-0 rounded bg-[#00e054] px-3 py-1.5 text-xs font-bold text-[#14181c] hover:bg-[#00c047]"
                  >
                    Select
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer with skip & close */}
        <div className="flex items-center justify-between border-t border-[#2c3440] px-6 py-4">
          <div className="text-xs text-[#99aabb]">
            {currentIndex + 1} of {reviewableFilms.length} items
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleSkip}
              className="rounded bg-[#2c3440] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#3d4756]"
            >
              Skip
            </button>
            <button
              onClick={onClose}
              className="rounded border border-[#2c3440] px-3 py-1.5 text-xs font-medium text-[#99aabb] hover:text-white"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
