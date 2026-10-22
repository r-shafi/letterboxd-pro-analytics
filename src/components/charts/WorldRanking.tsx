import React, { useState } from 'react';
import { CountryStats, LanguageStats } from '../../services/analytics/types.ts';
import { Globe, Languages, Star } from 'lucide-react';

interface WorldRankingProps {
  countries: CountryStats[];
  languages: LanguageStats[];
  nonEnglishShare: number;
  onSelectGroup: (name: string, filmKeys: string[]) => void;
}

export const WorldRanking: React.FC<WorldRankingProps> = ({
  countries,
  languages,
  nonEnglishShare,
  onSelectGroup
}) => {
  const [viewMode, setViewMode] = useState<'countries' | 'languages'>('countries');

  return (
    <div className="w-full space-y-4">
      {/* Top Controls & Non-English Highlight */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2c3440] pb-3">
        <div className="flex rounded-lg border border-[#2c3440] bg-[#14181c] p-1 text-xs">
          <button
            onClick={() => setViewMode('countries')}
            className={`flex items-center gap-1.5 rounded px-3 py-1 font-medium transition-colors ${
              viewMode === 'countries'
                ? 'bg-[#00e054] text-[#14181c] font-bold shadow'
                : 'text-[#99aabb] hover:text-white'
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            <span>Countries ({countries.length})</span>
          </button>
          <button
            onClick={() => setViewMode('languages')}
            className={`flex items-center gap-1.5 rounded px-3 py-1 font-medium transition-colors ${
              viewMode === 'languages'
                ? 'bg-[#00e054] text-[#14181c] font-bold shadow'
                : 'text-[#99aabb] hover:text-white'
            }`}
          >
            <Languages className="h-3.5 w-3.5" />
            <span>Languages ({languages.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 rounded bg-[#14181c] border border-[#2c3440] px-3 py-1 text-xs text-[#99aabb]">
          <span>Non-English Share:</span>
          <span className="font-mono font-bold text-[#00e054]">{nonEnglishShare}%</span>
        </div>
      </div>

      {/* Ranked List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
        {(viewMode === 'countries' ? countries : languages).slice(0, 30).map((item, idx) => (
          <button
            key={item.isoCode}
            onClick={() => onSelectGroup(item.name, item.filmKeys)}
            className="flex items-center justify-between rounded-lg border border-[#2c3440] bg-[#14181c] p-2.5 hover:border-[#00e054]/50 transition-colors text-left"
          >
            <div className="flex items-center space-x-2.5 truncate">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#222831] font-mono text-[10px] text-[#99aabb]">
                {idx + 1}
              </span>
              <span className="text-xs font-semibold text-white truncate">{item.name}</span>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <span className="text-[11px] font-mono text-[#99aabb]">
                {item.count} {item.count === 1 ? 'film' : 'films'}
              </span>
              {item.avgRating > 0 && (
                <div className="flex items-center gap-0.5 rounded bg-[#222831] px-1.5 py-0.5 text-[10px] font-bold text-[#00e054]">
                  <Star className="h-2.5 w-2.5 fill-current" />
                  <span>{item.avgRating.toFixed(1)}</span>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
