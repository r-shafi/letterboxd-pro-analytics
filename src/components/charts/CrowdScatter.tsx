import React from 'react';
import { CrowdScatterPoint } from '../../services/analytics/types.ts';
import { formatRatingDelta } from '../../services/analytics/statistical.ts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { CONFIG } from '../../config/env.ts';

interface CrowdScatterProps {
  scatterPoints: CrowdScatterPoint[];
  correlationR: number | null;
  meanDelta: number;
  biggestOverrates: CrowdScatterPoint[];
  biggestUnderrates: CrowdScatterPoint[];
  onSelectFilm: (filmKey: string) => void;
}

export const CrowdScatter: React.FC<CrowdScatterProps> = ({
  correlationR,
  meanDelta,
  biggestOverrates,
  biggestUnderrates,
  onSelectFilm
}) => {
  return (
    <div className="w-full space-y-6">
      {/* Metrics Banner */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-[#2c3440] bg-[#14181c] p-3 text-center">
          <div className="text-xs text-[#99aabb]">Crowd Correlation</div>
          <div className="mt-1 font-display text-xl font-bold text-white">
            {correlationR !== null ? correlationR.toFixed(2) : 'N/A (min n=20)'}
          </div>
          <div className="text-[10px] text-[#99aabb]/60 mt-0.5" title="How closely your ratings align with the global community (+1.0 is lockstep, 0 is independent, negative is contrarian).">
            Alignment with crowd (-1.0 to +1.0)
          </div>
        </div>

        <div className="rounded-lg border border-[#2c3440] bg-[#14181c] p-3 text-center">
          <div className="text-xs text-[#99aabb]">Generosity Index</div>
          <div className="mt-1 font-display text-xl font-bold text-[#00e054]">
            {formatRatingDelta(meanDelta, 2)}
          </div>
          <div className="text-[10px] text-[#99aabb]/60 mt-0.5">Mean rating delta vs crowd</div>
        </div>

        <div className="col-span-2 sm:col-span-1 rounded-lg border border-[#2c3440] bg-[#14181c] p-3 text-center">
          <div className="text-xs text-[#99aabb]">Sample Size</div>
          <div className="mt-1 font-display text-xl font-bold text-[#40bcf4]">
            {biggestOverrates.length + biggestUnderrates.length > 0 ? 'Qualified' : 'Collecting'}
          </div>
          <div className="text-[10px] text-[#99aabb]/60 mt-0.5">Films with &gt;= 100 community votes</div>
        </div>
      </div>

      {/* Diverging Bars: Top Overrates & Underrates */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Overrates (You liked more than crowd) */}
        <div className="rounded-lg border border-[#2c3440] bg-[#14181c] p-4">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#00e054] mb-3">
            <TrendingUp className="h-4 w-4" />
            <span>Highest Overrates (You &gt; Crowd)</span>
          </div>

          <div className="space-y-2.5">
            {biggestOverrates.slice(0, 5).map((point) => (
              <button
                key={point.filmKey}
                onClick={() => onSelectFilm(point.filmKey)}
                className="flex w-full items-center justify-between rounded p-1.5 hover:bg-[#1b2026] text-left transition-colors"
              >
                <div className="flex items-center space-x-2.5 truncate">
                  {point.posterPath ? (
                    <img
                      src={`${CONFIG.tmdbImageBase}/w92${point.posterPath}`}
                      alt={point.title}
                      className="h-10 w-7 rounded object-cover border border-[#2c3440]"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-10 w-7 rounded bg-[#222831]" />
                  )}
                  <div className="truncate">
                    <div className="text-xs font-semibold text-white truncate">{point.title}</div>
                    <div className="text-[10px] text-[#99aabb]">
                      You: <span className="font-bold text-[#00e054]">{point.userRating}★</span> vs Crowd: {point.tmdbRatingNorm}★
                    </div>
                  </div>
                </div>

                <div className="ml-2 rounded bg-[#00e054]/10 px-2 py-0.5 text-xs font-bold text-[#00e054] border border-[#00e054]/20">
                  +{point.delta.toFixed(2)}★
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Underrates (Crowd liked more than you) */}
        <div className="rounded-lg border border-[#2c3440] bg-[#14181c] p-4">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#ff8000] mb-3">
            <TrendingDown className="h-4 w-4" />
            <span>Biggest Underrates (Crowd &gt; You)</span>
          </div>

          <div className="space-y-2.5">
            {biggestUnderrates.slice(0, 5).map((point) => (
              <button
                key={point.filmKey}
                onClick={() => onSelectFilm(point.filmKey)}
                className="flex w-full items-center justify-between rounded p-1.5 hover:bg-[#1b2026] text-left transition-colors"
              >
                <div className="flex items-center space-x-2.5 truncate">
                  {point.posterPath ? (
                    <img
                      src={`${CONFIG.tmdbImageBase}/w92${point.posterPath}`}
                      alt={point.title}
                      className="h-10 w-7 rounded object-cover border border-[#2c3440]"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-10 w-7 rounded bg-[#222831]" />
                  )}
                  <div className="truncate">
                    <div className="text-xs font-semibold text-white truncate">{point.title}</div>
                    <div className="text-[10px] text-[#99aabb]">
                      You: <span className="font-bold text-[#ff8000]">{point.userRating}★</span> vs Crowd: {point.tmdbRatingNorm}★
                    </div>
                  </div>
                </div>

                <div className="ml-2 rounded bg-[#ff8000]/10 px-2 py-0.5 text-xs font-bold text-[#ff8000] border border-[#ff8000]/20">
                  {point.delta.toFixed(2)}★
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
