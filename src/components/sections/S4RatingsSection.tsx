import React from 'react';
import { S4Ratings } from '../../services/analytics/types.ts';
import { RatingsHistogram } from '../charts/RatingsHistogram.tsx';
import { formatRating, formatRatingDelta } from '../../services/analytics/statistical.ts';
import { Star, Repeat, Heart } from 'lucide-react';
import { CONFIG } from '../../config/env.ts';

interface S4RatingsSectionProps {
  ratings: S4Ratings;
  onSelectRating: (rating: number) => void;
  onSelectFilm: (filmKey: string) => void;
}

export const S4RatingsSection: React.FC<S4RatingsSectionProps> = ({
  ratings,
  onSelectRating,
  onSelectFilm
}) => {
  return (
    <section id="s4-ratings" className="space-y-6">
      <div className="border-b border-[#2c3440] pb-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#00e054]">
          Section 04 • Ratings
        </div>
        <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
          Rating Distribution & Behavior
        </h2>
        <p className="mt-1 text-xs text-[#99aabb]">
          Granular 10-bucket star histogram, central tendencies, decade distributions, and rewatch adjustments.
        </p>
      </div>

      {/* Main Histogram & Summary Bento */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Star Histogram (2 cols) */}
        <div className="lg:col-span-2 rounded-xl border border-[#2c3440] bg-[#1b2026] p-6 shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">Star Rating Histogram</h3>
            <span className="text-xs text-[#99aabb]">Tap any rating to view films</span>
          </div>

          <RatingsHistogram
            histogram={ratings.histogram}
            onSelectRating={onSelectRating}
          />
        </div>

        {/* Right: Statistical Metrics (1 col) */}
        <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-6 shadow-xl flex flex-col justify-between space-y-4">
          <h3 className="text-base font-bold text-white">Rating Metrics</h3>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-2 rounded bg-[#14181c] border border-[#2c3440]">
              <span className="text-[#99aabb]">Arithmetic Mean</span>
              <span className="font-mono text-lg font-bold text-[#00e054]">{formatRating(ratings.mean, 2)}</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-[#14181c] border border-[#2c3440]">
              <span className="text-[#99aabb]">Median</span>
              <span className="font-mono text-lg font-bold text-white">{formatRating(ratings.median, 1)}</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-[#14181c] border border-[#2c3440]">
              <span className="text-[#99aabb]">Mode (Most Frequent)</span>
              <span className="font-mono text-lg font-bold text-white">{formatRating(ratings.mode, 1)}</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-[#14181c] border border-[#2c3440]">
              <span className="text-[#99aabb]">Standard Deviation (&sigma;)</span>
              <span className="font-mono text-sm font-bold text-[#40bcf4]">{ratings.standardDeviation}</span>
            </div>
          </div>

          {/* Generous vs Harshest Years */}
          <div className="border-t border-[#2c3440] pt-3 text-[11px] space-y-1.5">
            <div className="text-[10px] text-[#99aabb]/70 uppercase tracking-wider font-semibold">
              By Release Year (min 5 films, balanced against overall average)
            </div>
            {ratings.mostGenerousYear && (
              <div className="flex justify-between text-[#99aabb]">
                <span>Most Generous Release Year:</span>
                <span className="font-bold text-[#00e054]">
                  {ratings.mostGenerousYear.year} ({formatRating(ratings.mostGenerousYear.avgRating, 2)} avg, {ratings.mostGenerousYear.count} films)
                </span>
              </div>
            )}
            {ratings.harshestYear && (
              <div className="flex justify-between text-[#99aabb]">
                <span>Harshest Release Year:</span>
                <span className="font-bold text-[#ff8000]">
                  {ratings.harshestYear.year} ({formatRating(ratings.harshestYear.avgRating, 2)} avg, {ratings.harshestYear.count} films)
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rewatch Effect & Liked vs Rated */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Rewatch Effect */}
        <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-6 shadow-xl space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
            <Repeat className="h-4 w-4 text-[#00e054]" />
            <span>The Rewatch Effect</span>
          </div>

          <p className="text-xs text-[#99aabb]">
            How your rating shifts when you rewatch a film compared to your initial screening.
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-[#2c3440] bg-[#14181c] p-3">
              <div className="text-[10px] text-[#00e054] font-semibold">Rated Higher</div>
              <div className="mt-1 font-display text-xl font-bold text-white">
                {ratings.rewatchRatingDelta.higherCount}
              </div>
            </div>

            <div className="rounded-lg border border-[#2c3440] bg-[#14181c] p-3">
              <div className="text-[10px] text-[#99aabb] font-semibold">Rated Same</div>
              <div className="mt-1 font-display text-xl font-bold text-white">
                {ratings.rewatchRatingDelta.sameCount}
              </div>
            </div>

            <div className="rounded-lg border border-[#2c3440] bg-[#14181c] p-3">
              <div className="text-[10px] text-[#ff8000] font-semibold">Rated Lower</div>
              <div className="mt-1 font-display text-xl font-bold text-white">
                {ratings.rewatchRatingDelta.lowerCount}
              </div>
            </div>
          </div>

          {ratings.rewatchRatingDelta.totalRewatched === 0 ? (
            <div className="text-xs text-[#99aabb] pt-1 italic">
              No films with multiple rated diary entries found in this period to compute rating change on rewatch.
            </div>
          ) : (
            <div className="text-xs text-[#ccdde6] pt-1">
              Average delta on rewatch: <strong className="text-[#00e054] font-mono">{formatRatingDelta(ratings.rewatchRatingDelta.averageDelta, 2)}</strong> across {ratings.rewatchRatingDelta.totalRewatched} rewatched titles.
            </div>
          )}
        </div>

        {/* Discordance: Liked vs Rated */}
        <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-6 shadow-xl space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
            <Heart className="h-4 w-4 text-[#ff8000]" />
            <span>Liked vs Rated Inconsistencies</span>
          </div>

          <p className="text-xs text-[#99aabb]">
            Films with surprising divergence between your binary heart (&ldquo;liked&rdquo;) and star rating.
          </p>

          <div className="space-y-3 pt-1 text-xs">
            <div className="rounded-lg border border-[#2c3440] bg-[#14181c] p-3">
              <div className="font-semibold text-white">
                Liked but Rated Low (&le; 2.5★): <span className="font-mono text-[#ff8000] font-bold">{ratings.likedVsRated.likedLowRated.length}</span> films
              </div>
              <p className="text-[11px] text-[#99aabb] mt-0.5">
                Guilty pleasures or movies with flawed executions you enjoyed regardless.
              </p>
            </div>

            <div className="rounded-lg border border-[#2c3440] bg-[#14181c] p-3">
              <div className="font-semibold text-white">
                5★ films you didn't heart: <span className="font-mono text-[#40bcf4] font-bold">{ratings.likedVsRated.unlikedFiveStars.length}</span> films
              </div>
              <p className="text-[11px] text-[#99aabb] mt-0.5">
                Masterpieces you rated a perfect 5.0★ without marking them with a heart.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 5-Star Club Wall */}
      {ratings.topRatedFilms.length > 0 && (
        <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-6 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
              <Star className="h-4 w-4 text-[#00e054] fill-[#00e054]" />
              <span>The 5★ Club ({ratings.topRatedFilms.length} Films)</span>
            </div>
            {ratings.topRatedFilms.length > 24 && (
              <span className="text-[11px] text-[#99aabb]">
                Showing first 24 of {ratings.topRatedFilms.length}
              </span>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12">
            {ratings.topRatedFilms.slice(0, 24).map((film) => (
              <button
                key={film.letterboxdUri}
                onClick={() => onSelectFilm(film.letterboxdUri)}
                className="film-poster-card group relative aspect-[2/3] w-full overflow-hidden rounded bg-[#14181c] focus:outline-none"
                title={film.name}
              >
                {film.metadata?.posterPath ? (
                  <img
                    src={`${CONFIG.tmdbImageBase}/w185${film.metadata.posterPath}`}
                    alt={film.name}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center p-1 text-[8px] text-[#99aabb] text-center">
                    {film.name}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
