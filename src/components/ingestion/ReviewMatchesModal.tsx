import React, { useState, useEffect, useRef, useMemo, useTransition } from 'react';
import { Film, TmdbMatchCandidate, TmdbMatchResult } from '../../types/domain.ts';
import { Check, Search, X, AlertCircle, RotateCcw, CheckCheck, HelpCircle } from 'lucide-react';
import { tmdbClient } from '../../services/tmdb/client.ts';
import { CONFIG } from '../../config/env.ts';
import { PosterImage } from '../common/PosterImage.tsx';

interface ReviewMatchesModalProps {
  films: Record<string, Film>;
  onClose: () => void;
  onOverrideMatch: (uri: string, candidate: TmdbMatchCandidate) => Promise<void>;
  onUndoOverrideMatch?: (uri: string, previousMatch: TmdbMatchResult) => Promise<void>;
  onMarkUnmatched?: (uri: string) => Promise<void>;
  onAcceptApproximateMatches?: () => Promise<number>;
  autoMatchedCount?: number;
}

interface UndoAction {
  filmKey: string;
  filmName: string;
  candidateTitle: string;
  candidateYear?: number;
  previousMatch: TmdbMatchResult;
}

type FilterCategory = 'all' | 'approximate_year' | 'same_title_duplicates' | 'no_confident_match' | 'skipped';

export const ReviewMatchesModal: React.FC<ReviewMatchesModalProps> = ({
  films,
  onClose,
  onOverrideMatch,
  onUndoOverrideMatch,
  onMarkUnmatched,
  onAcceptApproximateMatches,
  autoMatchedCount
}) => {
  // Freeze the reviewable list of film keys when the modal opens
  const [frozenKeys] = useState<string[]>(() => {
    return Object.keys(films).filter(
      (k) => films[k].match.status === 'ambiguous' || (films[k].match.status === 'unmatched' && !films[k].metadata)
    );
  });

  const [activeCategory, setActiveCategory] = useState<FilterCategory>('all');
  const [activeKeyIndex, setActiveKeyIndex] = useState(0);
  const [skippedKeys, setSkippedKeys] = useState<Set<string>>(new Set());
  const [resolvedKeys, setResolvedKeys] = useState<Set<string>>(new Set());
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Manual search state
  const [manualQuery, setManualQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<TmdbMatchCandidate[]>([]);

  // Approximate year bulk accept preview dialog
  const [showApproximatePreview, setShowApproximatePreview] = useState(false);
  const [isAcceptingApproximate, setIsAcceptingApproximate] = useState(false);

  // A11y focus management & scroll lock
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    previousActiveElement.current = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus first interactive element inside modal
    if (modalRef.current) {
      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length > 0) {
        focusable[0].focus();
      }
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, []);

  // Filtered queue based on activeCategory
  const visibleKeys = useMemo(() => {
    return frozenKeys.filter((key) => {
      const film = films[key];
      if (!film) return false;
      const isResolved = resolvedKeys.has(key);
      const isSkipped = skippedKeys.has(key);

      if (activeCategory === 'skipped') {
        return isSkipped && !isResolved;
      }

      if (isResolved) return false;

      if (activeCategory === 'all') {
        return true;
      }

      if (activeCategory === 'approximate_year') {
        return film.match.reason === 'approximate_year' || film.match.approximateYear === true;
      }

      if (activeCategory === 'same_title_duplicates') {
        return film.match.reason === 'same_title_duplicates';
      }

      if (activeCategory === 'no_confident_match') {
        return (
          film.match.reason === 'no_confident_match' ||
          film.match.reason === 'no_plausible_match' ||
          film.match.reason === 'unmatched'
        );
      }

      return true;
    });
  }, [frozenKeys, films, resolvedKeys, skippedKeys, activeCategory]);

  const currentKey = visibleKeys[activeKeyIndex] || visibleKeys[0];
  const currentFilm = currentKey ? films[currentKey] : null;

  // Approximate matches for bulk action
  const approximateMatches = useMemo(() => {
    return frozenKeys
      .map((k) => films[k])
      .filter(
        (f) =>
          Boolean(f) &&
          !resolvedKeys.has(f.letterboxdUri) &&
          (f.match.reason === 'approximate_year' || f.match.approximateYear === true) &&
          Boolean(f.match.candidates && f.match.candidates.length > 0)
      );
  }, [frozenKeys, films, resolvedKeys]);

  // Handle instant selection
  const handleSelectCandidate = (candidate: TmdbMatchCandidate) => {
    if (!currentFilm) return;

    const filmKey = currentFilm.letterboxdUri;
    const undoItem: UndoAction = {
      filmKey,
      filmName: currentFilm.name,
      candidateTitle: candidate.title,
      candidateYear: candidate.year,
      previousMatch: { ...currentFilm.match }
    };

    setUndoStack((prev) => [...prev, undoItem]);
    setResolvedKeys((prev) => new Set(prev).add(filmKey));
    setToastMessage(`Matched ${currentFilm.name} (${candidate.year || currentFilm.year || ''})`);

    // Reset manual search
    setSearchResults([]);
    setManualQuery('');

    // Advance immediately (optimistic UI)
    startTransition(() => {
      if (activeKeyIndex >= visibleKeys.length - 1) {
        setActiveKeyIndex(Math.max(0, visibleKeys.length - 2));
      }
    });

    // Execute cheap in-memory commit and background enrichment
    onOverrideMatch(filmKey, candidate);
  };

  // Handle Undo
  const handleUndo = async () => {
    if (undoStack.length === 0) return;
    const lastAction = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));

    setResolvedKeys((prev) => {
      const next = new Set(prev);
      next.delete(lastAction.filmKey);
      return next;
    });

    if (onUndoOverrideMatch) {
      await onUndoOverrideMatch(lastAction.filmKey, lastAction.previousMatch);
    }

    // Step back to this film
    const restoredIndex = visibleKeys.indexOf(lastAction.filmKey);
    if (restoredIndex !== -1) {
      setActiveKeyIndex(restoredIndex);
    } else {
      setActiveKeyIndex(0);
    }

    setToastMessage(null);
  };

  // Handle Skip
  const handleSkip = () => {
    if (!currentFilm) return;
    setSkippedKeys((prev) => new Set(prev).add(currentFilm.letterboxdUri));
    setSearchResults([]);
    setManualQuery('');

    if (activeKeyIndex < visibleKeys.length - 1) {
      setActiveKeyIndex((i) => i + 1);
    } else {
      setActiveKeyIndex(0);
    }
  };

  // Handle None of these
  const handleNoneOfThese = async () => {
    if (!currentFilm) return;
    const filmKey = currentFilm.letterboxdUri;

    const undoItem: UndoAction = {
      filmKey,
      filmName: currentFilm.name,
      candidateTitle: 'None (Unmatched)',
      previousMatch: { ...currentFilm.match }
    };
    setUndoStack((prev) => [...prev, undoItem]);
    setResolvedKeys((prev) => new Set(prev).add(filmKey));
    setToastMessage(`Marked ${currentFilm.name} as unmatched`);

    if (onMarkUnmatched) {
      await onMarkUnmatched(filmKey);
    }

    if (activeKeyIndex >= visibleKeys.length - 1) {
      setActiveKeyIndex(Math.max(0, visibleKeys.length - 2));
    }
  };

  // Handle Bulk Accept of Approximate Year matches
  const handleConfirmAcceptApproximate = async () => {
    setIsAcceptingApproximate(true);
    try {
      if (onAcceptApproximateMatches) {
        const count = await onAcceptApproximateMatches();
        approximateMatches.forEach((f) => {
          setResolvedKeys((prev) => new Set(prev).add(f.letterboxdUri));
        });
        setToastMessage(`Accepted ${count} approximate year matches`);
      }
    } finally {
      setIsAcceptingApproximate(false);
      setShowApproximatePreview(false);
      setActiveKeyIndex(0);
    }
  };

  // Manual search lookup
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
          popularity?: number;
          vote_average?: number;
          vote_count?: number;
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
        popularity: r.popularity,
        voteAverage: r.vote_average,
        voteCount: r.vote_count,
        confidenceScore: 1.0
      }));
      setSearchResults(candidates);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const displayedCandidates =
    searchResults.length > 0 ? searchResults : currentFilm?.match.candidates || [];

  // Keyboard navigation & shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if focus is in an input field
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        if (e.key === 'Escape') {
          onClose();
        }
        return;
      }

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key >= '1' && e.key <= '5') {
        const num = parseInt(e.key, 10);
        if (displayedCandidates[num - 1]) {
          handleSelectCandidate(displayedCandidates[num - 1]);
        }
      } else if (e.key.toLowerCase() === 's') {
        handleSkip();
      } else if (e.key.toLowerCase() === 'z') {
        handleUndo();
      } else if (e.key === 'ArrowRight') {
        if (activeKeyIndex < visibleKeys.length - 1) {
          setActiveKeyIndex((i) => i + 1);
        }
      } else if (e.key === 'ArrowLeft') {
        if (activeKeyIndex > 0) {
          setActiveKeyIndex((i) => i - 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [displayedCandidates, activeKeyIndex, visibleKeys.length, undoStack.length]);

  const totalReviewItems = frozenKeys.length;
  const remainingCount = totalReviewItems - resolvedKeys.size;
  const autoMatches = autoMatchedCount || Object.keys(films).length - totalReviewItems;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-modal-title"
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm sm:p-4"
    >
      <div className="flex h-full w-full flex-col bg-[#1b2026] text-white sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-xl sm:border sm:border-[#2c3440] sm:shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2c3440] px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-[#ff8000]" />
            <h2 id="review-modal-title" className="text-base font-bold text-white">
              Review film matches
            </h2>
            {remainingCount > 0 && (
              <span className="rounded-full bg-[#ff8000]/15 px-2 py-0.5 text-[11px] font-medium text-[#ff8000]">
                {remainingCount} left
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-[#99aabb] hover:bg-[#2c3440] hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Informative Summary Banner (2-3 lines per specification) */}
        <div className="border-b border-[#2c3440] bg-[#14181c]/70 px-4 py-2.5 sm:px-6 text-xs text-[#99aabb] leading-relaxed">
          <p>
            <strong className="text-white">{autoMatches.toLocaleString()}</strong> films matched automatically.{' '}
            <strong className="text-[#ff8000]">{totalReviewItems}</strong> films require manual review.
          </p>
          <p className="mt-0.5 text-[11px] text-[#99aabb]/80">
            Skipped films still count in your ratings, dates, and rewatches, but are left out of cast, genre, and runtime stats.
          </p>
        </div>

        {/* Toast confirmation with Undo */}
        {toastMessage && (
          <div className="flex items-center justify-between bg-[#00e054]/15 border-b border-[#00e054]/30 px-4 py-2 sm:px-6 text-xs text-[#00e054]">
            <div className="flex items-center gap-1.5 font-medium">
              <Check className="h-4 w-4" />
              <span>{toastMessage}</span>
            </div>
            <button
              onClick={handleUndo}
              className="inline-flex items-center gap-1 rounded bg-[#00e054]/20 px-2 py-0.5 font-bold hover:bg-[#00e054]/30"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Undo (Z)</span>
            </button>
          </div>
        )}

        {/* Grouping Filter Tabs */}
        <div className="flex items-center justify-between border-b border-[#2c3440] px-4 py-2 sm:px-6 overflow-x-auto text-xs">
          <div className="flex gap-1.5">
            <button
              onClick={() => {
                setActiveCategory('all');
                setActiveKeyIndex(0);
              }}
              className={`rounded px-2.5 py-1 font-medium transition-colors ${
                activeCategory === 'all'
                  ? 'bg-[#2c3440] text-white'
                  : 'text-[#99aabb] hover:text-white'
              }`}
            >
              All ({frozenKeys.filter((k) => !resolvedKeys.has(k)).length})
            </button>
            <button
              onClick={() => {
                setActiveCategory('same_title_duplicates');
                setActiveKeyIndex(0);
              }}
              className={`rounded px-2.5 py-1 font-medium transition-colors ${
                activeCategory === 'same_title_duplicates'
                  ? 'bg-[#2c3440] text-white'
                  : 'text-[#99aabb] hover:text-white'
              }`}
            >
              Same Title & Year
            </button>
            <button
              onClick={() => {
                setActiveCategory('approximate_year');
                setActiveKeyIndex(0);
              }}
              className={`rounded px-2.5 py-1 font-medium transition-colors ${
                activeCategory === 'approximate_year'
                  ? 'bg-[#2c3440] text-white'
                  : 'text-[#99aabb] hover:text-white'
              }`}
            >
              Approximate Year
            </button>
            <button
              onClick={() => {
                setActiveCategory('no_confident_match');
                setActiveKeyIndex(0);
              }}
              className={`rounded px-2.5 py-1 font-medium transition-colors ${
                activeCategory === 'no_confident_match'
                  ? 'bg-[#2c3440] text-white'
                  : 'text-[#99aabb] hover:text-white'
              }`}
            >
              No Confident Match
            </button>
            {skippedKeys.size > 0 && (
              <button
                onClick={() => {
                  setActiveCategory('skipped');
                  setActiveKeyIndex(0);
                }}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${
                  activeCategory === 'skipped'
                    ? 'bg-[#2c3440] text-white'
                    : 'text-[#ff8000] hover:underline'
                }`}
              >
                Skipped ({skippedKeys.size})
              </button>
            )}
          </div>

          {approximateMatches.length > 0 && (
            <button
              onClick={() => setShowApproximatePreview(true)}
              className="hidden sm:inline-flex items-center gap-1 rounded bg-[#00e054]/15 px-2.5 py-1 text-xs font-semibold text-[#00e054] hover:bg-[#00e054]/25"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Accept approximate ({approximateMatches.length})
            </button>
          )}
        </div>

        {/* Main Content Area */}
        {visibleKeys.length === 0 || !currentFilm ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#00e054]/10 text-[#00e054]">
              <Check className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-base font-bold text-white">All Matches in this Category Reviewed</h3>
            <p className="mt-1 text-xs text-[#99aabb]">
              {skippedKeys.size > 0
                ? `You have ${skippedKeys.size} skipped films available to revisit.`
                : 'All film matches have been reviewed or resolved.'}
            </p>
            <div className="mt-6 flex gap-2">
              {skippedKeys.size > 0 && activeCategory !== 'skipped' && (
                <button
                  onClick={() => {
                    setActiveCategory('skipped');
                    setActiveKeyIndex(0);
                  }}
                  className="rounded-lg bg-[#2c3440] px-4 py-2 text-xs font-semibold text-white hover:bg-[#3d4756]"
                >
                  Review Skipped Films ({skippedKeys.size})
                </button>
              )}
              <button
                onClick={onClose}
                className="rounded-lg bg-[#00e054] px-4 py-2 text-xs font-bold text-[#14181c] hover:bg-[#00c047]"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-y-auto">
            {/* Target Letterboxd Film Info */}
            <div className="border-b border-[#2c3440] bg-[#14181c] px-4 py-3 sm:px-6">
              <div className="flex items-center justify-between text-xs text-[#99aabb]">
                <span className="uppercase tracking-wider">Letterboxd Item:</span>
                <span className="font-mono text-[11px]">
                  {activeKeyIndex + 1} of {visibleKeys.length}
                </span>
              </div>
              <div className="mt-1 flex items-baseline space-x-2">
                <span className="font-display text-lg font-bold text-white">{currentFilm.name}</span>
                {currentFilm.year && (
                  <span className="text-sm font-medium text-[#99aabb]">({currentFilm.year})</span>
                )}
                {currentFilm.match.reason && (
                  <span className="rounded bg-[#2c3440] px-1.5 py-0.5 text-[10px] text-[#ff8000]">
                    {currentFilm.match.reason === 'same_title_duplicates'
                      ? 'Duplicate TMDb entries'
                      : currentFilm.match.reason === 'approximate_year'
                      ? 'Approximate Year'
                      : 'Needs confirmation'}
                  </span>
                )}
              </div>
              <div className="mt-0.5 truncate font-mono text-[11px] text-[#99aabb]/60">
                {currentFilm.letterboxdUri}
              </div>
            </div>

            {/* Candidate List & Manual Search */}
            <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-6 space-y-3">
              {/* Manual search bar */}
              <form onSubmit={handleManualSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#99aabb]" />
                  <input
                    type="text"
                    value={manualQuery}
                    onChange={(e) => setManualQuery(e.target.value)}
                    placeholder={`Search for a film...`}
                    className="w-full rounded-lg border border-[#2c3440] bg-[#14181c] py-2 pl-9 pr-3 text-xs text-white placeholder-[#99aabb]/60 focus:border-[#00e054] focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearching}
                  className="rounded-lg bg-[#2c3440] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#3d4756] disabled:opacity-50"
                >
                  {isSearching ? 'Searching...' : 'Search'}
                </button>
              </form>

              {/* Candidates list */}
              {displayedCandidates.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#2c3440] p-8 text-center text-xs text-[#99aabb]">
                  <HelpCircle className="mx-auto h-8 w-8 text-[#99aabb]/40" />
                  <p className="mt-2 font-medium">No candidates found in TMDb movies.</p>
                  <p className="mt-1 text-[11px] text-[#99aabb]/70">
                    Use the search bar above to look up this title manually, or click "None of these".
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {displayedCandidates.map((candidate, idx) => {
                    const isExactYear = currentFilm.year !== undefined && candidate.year === currentFilm.year;
                    const isBestMatch = idx === 0 && searchResults.length === 0;

                    return (
                      <div
                        key={candidate.id}
                        className={`flex items-start justify-between rounded-lg border p-3 transition-colors ${
                          isBestMatch
                            ? 'border-[#00e054]/50 bg-[#00e054]/5'
                            : 'border-[#2c3440] bg-[#14181c] hover:border-[#00e054]/40'
                        }`}
                      >
                        <div className="flex space-x-3 min-w-0 flex-1">
                          {/* Fixed size placeholder prevents layout shift */}
                          <div className="h-16 w-11 shrink-0 overflow-hidden rounded border border-[#2c3440] bg-[#222831]">
                            <PosterImage
                              src={
                                candidate.posterPath
                                  ? `${CONFIG.tmdbImageBase}/w92${candidate.posterPath}`
                                  : null
                              }
                              alt={candidate.title}
                              className="h-16 w-11 object-cover"
                              fallbackIcon={
                                <div className="flex h-16 w-11 items-center justify-center text-[9px] text-[#99aabb] text-center p-1">
                                  No poster
                                </div>
                              }
                              loading="lazy"
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-bold text-white truncate max-w-full">
                                {candidate.title}
                              </span>
                              {candidate.year && (
                                <span className="text-xs text-[#99aabb]">({candidate.year})</span>
                              )}
                              {isExactYear && (
                                <span className="rounded bg-[#00e054]/20 px-1.5 py-0.2 text-[10px] font-semibold text-[#00e054]">
                                  Exact year
                                </span>
                              )}
                              {isBestMatch && (
                                <span className="rounded bg-[#00e054] px-1.5 py-0.2 text-[10px] font-bold text-[#14181c]">
                                  Best match
                                </span>
                              )}
                              {candidate.confidenceScore > 0 && (
                                <span className="rounded bg-[#2c3440] px-1.5 py-0.2 text-[10px] font-mono text-[#00e054]">
                                  {Math.round(candidate.confidenceScore * 100)}%
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
                          className="ml-3 shrink-0 rounded bg-[#00e054] px-3 py-1.5 text-xs font-bold text-[#14181c] hover:bg-[#00c047] active:scale-95 transition-transform"
                          title={`Select candidate ${idx + 1} (Shortcut: ${idx + 1})`}
                        >
                          Select {idx < 5 ? `(${idx + 1})` : ''}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer with Skip, None of these, Shortcuts, and Close */}
        <div className="flex flex-wrap items-center justify-between border-t border-[#2c3440] px-4 py-3 sm:px-6 gap-2">
          <div className="flex items-center space-x-2 text-xs text-[#99aabb]">
            {undoStack.length > 0 && (
              <button
                onClick={handleUndo}
                className="inline-flex items-center gap-1 rounded bg-[#2c3440] px-2.5 py-1.5 font-medium text-white hover:bg-[#3d4756]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Undo (Z)
              </button>
            )}
            <button
              onClick={handleNoneOfThese}
              disabled={!currentFilm}
              className="rounded border border-[#2c3440] px-2.5 py-1.5 font-medium text-[#99aabb] hover:text-white disabled:opacity-40"
            >
              None of these
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleSkip}
              disabled={!currentFilm}
              className="rounded bg-[#2c3440] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#3d4756] disabled:opacity-40"
              title="Skip this film (Shortcut: S)"
            >
              Skip (S)
            </button>
            <button
              onClick={onClose}
              className="rounded border border-[#2c3440] px-3 py-1.5 text-xs font-medium text-[#99aabb] hover:text-white"
            >
              Close
            </button>
          </div>
        </div>

        {/* Approximate Year Preview & Confirmation Dialog */}
        {showApproximatePreview && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/90 p-4">
            <div className="w-full max-w-md rounded-xl border border-[#2c3440] bg-[#1b2026] p-5 shadow-2xl">
              <h3 className="text-base font-bold text-white">Accept Approximate Year Matches</h3>
              <p className="mt-1 text-xs text-[#99aabb]">
                The following {approximateMatches.length} films have exact title matches with a release year ±1 year off (often festival vs theatrical release):
              </p>
              <div className="my-3 max-h-48 overflow-y-auto rounded border border-[#2c3440] bg-[#14181c] p-2 space-y-1.5 text-xs">
                {approximateMatches.map((film) => {
                  const cand = film.match.candidates?.[0];
                  return (
                    <div key={film.letterboxdUri} className="flex justify-between items-center text-[#ccdde6]">
                      <span className="truncate pr-2 font-medium">{film.name}</span>
                      <span className="font-mono text-[#99aabb] shrink-0">
                        {film.year} → {cand?.year}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setShowApproximatePreview(false)}
                  disabled={isAcceptingApproximate}
                  className="rounded border border-[#2c3440] px-3 py-1.5 text-xs font-medium text-[#99aabb] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmAcceptApproximate}
                  disabled={isAcceptingApproximate}
                  className="rounded bg-[#00e054] px-4 py-1.5 text-xs font-bold text-[#14181c] hover:bg-[#00c047]"
                >
                  {isAcceptingApproximate ? 'Accepting...' : `Accept All (${approximateMatches.length})`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
