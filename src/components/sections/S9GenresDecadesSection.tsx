import React from 'react';
import { S9GenresDecades } from '../../services/analytics/types.ts';
import { Layers, Calendar, Star } from 'lucide-react';
import { CONFIG } from '../../config/env.ts';

interface S9GenresDecadesSectionProps {
  genresDecades: S9GenresDecades;
  onSelectFilm: (filmKey: string) => void;
}

export const S9GenresDecadesSection: React.FC<S9GenresDecadesSectionProps> = ({
  genresDecades,
  onSelectFilm
}) => {
  return (
    <section id="s9-genres" className="space-y-6">
      <div className="border-b border-[#2c3440] pb-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#00e054]">
          Section 09 • Genres & Decades
        </div>
        <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
          Genres, Eras & Time Travel
        </h2>
        <p className="mt-1 text-xs text-[#99aabb]">
          Ranked film genres by screen hours, release decades distribution, and temporal milestones.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Genre Rankings */}
        <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
            <Layers className="h-4 w-4 text-[#00e054]" />
            <span>Genre Breakdown by Screen Time</span>
          </div>

          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {genresDecades.genres.map((g) => (
              <div
                key={g.name}
                className="flex items-center justify-between rounded-lg border border-[#2c3440] bg-[#14181c] p-2.5 text-xs"
              >
                <div>
                  <span className="font-bold text-white">{g.name}</span>
                  <div className="text-[10px] text-[#99aabb]">
                    {g.count} films • {g.hours} hrs
                  </div>
                </div>

                {g.avgRating > 0 && (
                  <div className="flex items-center gap-0.5 rounded bg-[#222831] px-2 py-1 text-xs font-bold text-[#00e054]">
                    <Star className="h-3 w-3 fill-[#00e054]" />
                    <span>{g.avgRating.toFixed(1)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Release Decades Breakdown */}
        <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
            <Calendar className="h-4 w-4 text-[#40bcf4]" />
            <span>Release Decades Distribution</span>
          </div>

          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {genresDecades.decades.map((d) => (
              <div
                key={d.decade}
                className="flex items-center justify-between rounded-lg border border-[#2c3440] bg-[#14181c] p-2.5 text-xs"
              >
                <div>
                  <span className="font-mono font-bold text-white">{d.decade}s</span>
                  <div className="text-[10px] text-[#99aabb]">{d.count} films watched</div>
                </div>

                {d.avgRating > 0 && (
                  <div className="flex items-center gap-0.5 rounded bg-[#222831] px-2 py-1 text-xs font-bold text-[#00e054]">
                    <Star className="h-3 w-3 fill-[#00e054]" />
                    <span>{d.avgRating.toFixed(1)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Oldest and Newest Films Row */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Oldest Films */}
        {genresDecades.oldestFilms.length > 0 && (
          <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-6 shadow-xl space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-[#99aabb]">
              Earliest Release Year Watched
            </div>
            <div className="flex items-center space-x-3">
              {genresDecades.oldestFilms[0].metadata?.posterPath && (
                <img
                  src={`${CONFIG.tmdbImageBase}/w92${genresDecades.oldestFilms[0].metadata.posterPath}`}
                  alt={genresDecades.oldestFilms[0].name}
                  className="h-16 w-11 rounded object-cover border border-[#2c3440]"
                />
              )}
              <div>
                <button
                  onClick={() => onSelectFilm(genresDecades.oldestFilms[0].letterboxdUri)}
                  className="font-display text-base font-bold text-white hover:text-[#00e054] text-left"
                >
                  {genresDecades.oldestFilms[0].name}
                </button>
                <div className="text-xs text-[#00e054] font-mono mt-0.5">
                  Released {genresDecades.oldestFilms[0].year}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Newest Films */}
        {genresDecades.newestFilms.length > 0 && (
          <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-6 shadow-xl space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-[#99aabb]">
              Most Recent Release Year Watched
            </div>
            <div className="flex items-center space-x-3">
              {genresDecades.newestFilms[0].metadata?.posterPath && (
                <img
                  src={`${CONFIG.tmdbImageBase}/w92${genresDecades.newestFilms[0].metadata.posterPath}`}
                  alt={genresDecades.newestFilms[0].name}
                  className="h-16 w-11 rounded object-cover border border-[#2c3440]"
                />
              )}
              <div>
                <button
                  onClick={() => onSelectFilm(genresDecades.newestFilms[0].letterboxdUri)}
                  className="font-display text-base font-bold text-white hover:text-[#00e054] text-left"
                >
                  {genresDecades.newestFilms[0].name}
                </button>
                <div className="text-xs text-[#40bcf4] font-mono mt-0.5">
                  Released {genresDecades.newestFilms[0].year}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
