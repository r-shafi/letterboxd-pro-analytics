import React, { useState } from 'react';
import { S12Watchlist } from '../../services/analytics/types.ts';
import { Film } from '../../types/domain.ts';
import { Bookmark, Sparkles, Shuffle, Star, Clock } from 'lucide-react';
import { CONFIG } from '../../config/env.ts';

interface S12WatchlistSectionProps {
  watchlist: S12Watchlist;
  onSelectFilm: (filmKey: string) => void;
}

export const S12WatchlistSection: React.FC<S12WatchlistSectionProps> = ({
  watchlist,
  onSelectFilm
}) => {
  const [randomPick, setRandomPick] = useState<Film | null>(null);

  const handleRandomPick = () => {
    if (watchlist.predictions.length === 0) return;
    const randomIndex = Math.floor(Math.random() * watchlist.predictions.length);
    setRandomPick(watchlist.predictions[randomIndex].film);
  };

  return (
    <section id="s12-watchlist" className="space-y-6">
      <div className="border-b border-[#2c3440] pb-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#00e054]">
          Section 12 • Watchlist
        </div>
        <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
          Watchlist & Predictive Model
        </h2>
        <p className="mt-1 text-xs text-[#99aabb]">
          Backlog volume, years to completion at your pace, and explainable on-device rating predictions.
        </p>
      </div>

      {/* Headline Stats Banner */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-4 shadow">
          <div className="flex items-center justify-between text-[#99aabb]">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Backlog Size</span>
            <Bookmark className="h-4 w-4 text-[#40bcf4]" />
          </div>
          <div className="mt-2 font-display text-3xl font-extrabold text-white">
            {watchlist.totalCount} films
          </div>
          <div className="mt-1 text-[11px] text-[#99aabb]">
            {watchlist.backlogHours} hours of cinema queued
          </div>
        </div>

        <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-4 shadow">
          <div className="flex items-center justify-between text-[#99aabb]">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Estimated Clearance</span>
            <Clock className="h-4 w-4 text-[#00e054]" />
          </div>
          <div className="mt-2 font-display text-3xl font-extrabold text-[#00e054]">
            ~{watchlist.yearsToClearAtPace} years
          </div>
          <div className="mt-1 text-[11px] text-[#99aabb]">
            At your current yearly viewing rate
          </div>
        </div>

        <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-4 shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[#99aabb]">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Prediction Accuracy</span>
              <Sparkles className="h-4 w-4 text-[#ff8000]" />
            </div>
            <div className="mt-2 font-display text-xl font-bold text-white">
              MAE &plusmn;{watchlist.predictionModelMae}★
            </div>
            <div className="mt-0.5 text-[10px] text-[#99aabb]">
              Leave-one-out backtest error
            </div>
          </div>

          <button
            onClick={handleRandomPick}
            className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#2c3440] bg-[#14181c] py-1.5 px-3 text-xs font-semibold text-[#ccdde6] hover:border-[#00e054] hover:text-white transition-colors"
          >
            <Shuffle className="h-3.5 w-3.5 text-[#00e054]" />
            <span>Random Pick from Watchlist</span>
          </button>
        </div>
      </div>

      {/* Random Pick Highlight Modal / Alert */}
      {randomPick && (
        <div className="rounded-xl border border-[#00e054] bg-[#00e054]/5 p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-xl">🎲</span>
            <div>
              <div className="text-xs text-[#99aabb]">Tonight&apos;s Recommendation:</div>
              <button
                onClick={() => onSelectFilm(randomPick.letterboxdUri)}
                className="font-display text-base font-bold text-white hover:underline text-left"
              >
                {randomPick.name} ({randomPick.year})
              </button>
            </div>
          </div>
          <button
            onClick={() => setRandomPick(null)}
            className="text-xs text-[#99aabb] hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Predicted "Watch Next" List */}
      <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Top Recommended: Watch Next</h3>
          <span className="text-xs text-[#00e054] font-medium">Ranked by Personal Affinity Model</span>
        </div>

        <div className="space-y-3">
          {watchlist.predictions.slice(0, 10).map(({ film, predictedRating, topFactors }) => (
            <div
              key={film.letterboxdUri}
              className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-[#2c3440] bg-[#14181c] p-3 hover:border-[#00e054]/50 transition-colors gap-3"
            >
              <div className="flex items-center space-x-3 truncate">
                {film.metadata?.posterPath ? (
                  <img
                    src={`${CONFIG.tmdbImageBase}/w92${film.metadata.posterPath}`}
                    alt={film.name}
                    className="h-14 w-10 rounded object-cover border border-[#2c3440]"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-14 w-10 rounded bg-[#222831]" />
                )}

                <div className="truncate">
                  <button
                    onClick={() => onSelectFilm(film.letterboxdUri)}
                    className="font-semibold text-sm text-white hover:text-[#00e054] text-left truncate block"
                  >
                    {film.name} {film.year && <span className="text-xs text-[#99aabb]">({film.year})</span>}
                  </button>

                  {/* Explainability pills */}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {topFactors.map((factor, idx) => (
                      <span
                        key={idx}
                        className="rounded bg-[#222831] px-1.5 py-0.5 text-[10px] text-[#ccdde6]"
                      >
                        {factor}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Predicted Rating Chip */}
              <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                <span className="text-[11px] text-[#99aabb]">Likely for you:</span>
                <div className="flex items-center gap-1 rounded bg-[#00e054]/10 border border-[#00e054]/30 px-2.5 py-1 font-mono text-sm font-bold text-[#00e054]">
                  <Star className="h-3.5 w-3.5 fill-[#00e054]" />
                  <span>{predictedRating.toFixed(1)}★</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
