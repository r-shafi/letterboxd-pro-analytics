import React from 'react';
import { S10Rewatches } from '../../services/analytics/types.ts';
import { Repeat } from 'lucide-react';
import { CONFIG } from '../../config/env.ts';
import { PosterImage } from '../common/PosterImage.tsx';

interface S10RewatchesSectionProps {
  rewatches: S10Rewatches;
  onSelectFilm: (filmKey: string) => void;
}

export const S10RewatchesSection: React.FC<S10RewatchesSectionProps> = ({
  rewatches,
  onSelectFilm
}) => {
  return (
    <section id="s10-rewatches" className="space-y-6">
      <div className="border-b border-[#2c3440] pb-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#00e054]">
          Section 10 • Rewatches
        </div>
        <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
          Rewatch Cycles & Favorites
        </h2>
        <p className="mt-1 text-xs text-[#99aabb]">
          Films with multiple recorded viewings in your diary and your overall rewatching tendencies.
        </p>
      </div>

      {/* Top Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-6 shadow-xl flex flex-col justify-center text-center">
          <div className="text-xs uppercase tracking-wider text-[#99aabb]">Total Rewatch Rate</div>
          <div className="mt-2 font-display text-4xl font-black text-[#00e054]">
            {rewatches.rewatchRate}%
          </div>
          <div className="mt-1 text-xs text-[#99aabb]">of all logged screenings</div>
        </div>

        <div className="md:col-span-2 rounded-xl border border-[#2c3440] bg-[#1b2026] p-6 shadow-xl space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
            <Repeat className="h-4 w-4 text-[#00e054]" />
            <span>Most Rewatched Films</span>
          </div>

          <div className="space-y-2">
            {rewatches.topRewatched.slice(0, 5).filter(item => Boolean(item.film)).map(({ film, count }) => (
              <button
                key={film.letterboxdUri}
                onClick={() => onSelectFilm(film.letterboxdUri)}
                className="flex w-full items-center justify-between rounded-lg border border-[#2c3440] bg-[#14181c] p-2 hover:border-[#00e054] text-left transition-colors"
              >
                <div className="flex items-center space-x-3 truncate">
                  <PosterImage
                    src={film.metadata?.posterPath ? `${CONFIG.tmdbImageBase}/w92${film.metadata.posterPath}` : null}
                    alt={film.name}
                    className="h-10 w-7 rounded object-cover border border-[#2c3440]"
                    fallbackIcon={<div className="h-10 w-7 rounded bg-[#222831]" />}
                  />
                  <div className="truncate">
                    <span className="text-xs font-bold text-white truncate block">{film.name}</span>
                    <span className="text-[10px] text-[#99aabb]">{film.year}</span>
                  </div>
                </div>

                <div className="ml-3 shrink-0 rounded bg-[#00e054]/10 px-2 py-0.5 text-xs font-mono font-bold text-[#00e054]">
                  {count} viewings
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
