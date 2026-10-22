import React, { useState } from 'react';
import { TasteAffinityGroup } from '../../services/analytics/types.ts';
import { formatRating, formatRatingDelta } from '../../services/analytics/statistical.ts';

interface TasteAffinityChartProps {
  genreAffinity: TasteAffinityGroup[];
  decadeAffinity: TasteAffinityGroup[];
  countryAffinity: TasteAffinityGroup[];
  languageAffinity: TasteAffinityGroup[];
  overallMean: number;
}

export const TasteAffinityChart: React.FC<TasteAffinityChartProps> = ({
  genreAffinity,
  decadeAffinity,
  countryAffinity,
  languageAffinity,
  overallMean
}) => {
  const [activeTab, setActiveTab] = useState<'genre' | 'decade' | 'country' | 'language'>('genre');

  const groups =
    activeTab === 'genre'
      ? genreAffinity
      : activeTab === 'decade'
      ? decadeAffinity
      : activeTab === 'country'
      ? countryAffinity
      : languageAffinity;

  return (
    <div className="w-full space-y-4">
      {/* Category selector tabs */}
      <div className="flex rounded-lg border border-[#2c3440] bg-[#14181c] p-1 text-xs">
        {(['genre', 'decade', 'country', 'language'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded py-1.5 font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'bg-[#2c3440] text-white font-bold'
                : 'text-[#99aabb] hover:text-white'
            }`}
          >
            {tab}s
          </button>
        ))}
      </div>

      {/* Horizontal diverging bars */}
      <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
        {groups.slice(0, 15).map((group) => {
          const isAbove = group.relativeToOverall >= 0;
          const barWidthPercent = Math.min(100, Math.max(10, Math.abs(group.relativeToOverall) * 80));

          return (
            <div
              key={group.name}
              className="flex items-center justify-between rounded-lg border border-[#2c3440] bg-[#14181c] p-2.5 text-xs"
            >
              <div className="flex-1 min-w-0 pr-3">
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold text-white truncate">{group.name}</span>
                  <span className="text-[10px] text-[#99aabb] font-mono">
                    n={group.n} • {formatRating(group.shrunkMean, 2)}
                  </span>
                </div>

                {/* Relative Bar */}
                <div className="mt-1.5 h-1.5 w-full bg-[#1b2026] rounded-full overflow-hidden flex">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isAbove ? 'bg-[#00e054]' : 'bg-[#ff8000]'
                    }`}
                    style={{ width: `${barWidthPercent}%` }}
                  />
                </div>
              </div>

              <div
                className={`ml-2 shrink-0 rounded px-2 py-0.5 font-mono text-[11px] font-bold ${
                  isAbove ? 'bg-[#00e054]/10 text-[#00e054]' : 'bg-[#ff8000]/10 text-[#ff8000]'
                }`}
              >
                {formatRatingDelta(group.relativeToOverall, 2)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-[10px] text-[#99aabb] text-center border-t border-[#2c3440] pt-2">
        Smoothed to balance small samples against your overall average ({formatRating(overallMean, 2)}).
      </div>
    </div>
  );
};
