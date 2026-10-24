import React from 'react';
import { TimeFilter, TimeRangeOption } from '../../services/analytics/types.ts';
import { Calendar, Filter, Clock, AlertCircle } from 'lucide-react';

interface ControlBarProps {
  filter: TimeFilter;
  onFilterChange: (filter: TimeFilter) => void;
  availableYears: number[];
  totalFilms: number;
  dateUnknownCount: number;
  matchedCount: number;
  reviewNeededCount?: number;
  onOpenReviewMatches?: () => void;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  filter,
  onFilterChange,
  availableYears,
  totalFilms,
  dateUnknownCount,
  matchedCount,
  reviewNeededCount,
  onOpenReviewMatches
}) => {
  const handleRangeChange = (range: TimeRangeOption) => {
    if (range === 'year') {
      const latestYear = availableYears[availableYears.length - 1] || new Date().getFullYear();
      onFilterChange({ range, selectedYear: latestYear });
    } else {
      onFilterChange({ range });
    }
  };

  const handleYearChange = (year: number) => {
    onFilterChange({ range: 'year', selectedYear: year });
  };

  return (
    <div className="sticky top-14 z-30 w-full border-b border-[#2c3440] bg-[#1b2026]/95 backdrop-blur-md transition-all">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 py-2.5 text-xs">
        {/* Time Range Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 font-medium text-[#99aabb]">
            <Filter className="h-3.5 w-3.5 text-[#00e054]" />
            <span className="hidden sm:inline">Time Range:</span>
          </div>

          <div className="flex rounded-lg border border-[#2c3440] bg-[#14181c] p-0.5">
            <button
              onClick={() => handleRangeChange('all')}
              className={`rounded-md px-3 py-1 font-medium transition-colors ${
                filter.range === 'all'
                  ? 'bg-[#00e054] text-[#14181c] font-bold shadow'
                  : 'text-[#99aabb] hover:text-white'
              }`}
            >
              All Time
            </button>

            <button
              onClick={() => handleRangeChange('year')}
              className={`rounded-md px-3 py-1 font-medium transition-colors ${
                filter.range === 'year'
                  ? 'bg-[#00e054] text-[#14181c] font-bold shadow'
                  : 'text-[#99aabb] hover:text-white'
              }`}
            >
              Single Year
            </button>
          </div>

          {filter.range === 'year' && availableYears.length > 0 && (
            <select
              value={filter.selectedYear || availableYears[availableYears.length - 1]}
              onChange={(e) => handleYearChange(parseInt(e.target.value, 10))}
              aria-label="Select Year"
              className="rounded-lg border border-[#2c3440] bg-[#14181c] px-2.5 py-1 font-mono text-white focus:border-[#00e054] focus:outline-none"
            >
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Coverage & Unknown Date Disclosures */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#99aabb]">
          {filter.range !== 'all' && dateUnknownCount > 0 && (
            <div className="flex items-center gap-1 text-[#ff8000]" title="Films without a diary watch date cannot appear in time-filtered views">
              <Clock className="h-3 w-3" />
              <span>{dateUnknownCount} films without watch date not shown</span>
            </div>
          )}

          {reviewNeededCount !== undefined && reviewNeededCount > 0 && onOpenReviewMatches && (
            <button
              onClick={onOpenReviewMatches}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#ff8000]/15 px-2.5 py-0.5 text-[11px] font-semibold text-[#ff8000] border border-[#ff8000]/30 hover:bg-[#ff8000]/25 transition-colors"
            >
              <AlertCircle className="h-3 w-3 text-[#ff8000]" />
              <span>{reviewNeededCount} films need review</span>
            </button>
          )}

          <div className="flex items-center gap-1 rounded bg-[#14181c] px-2 py-0.5 border border-[#2c3440]">
            <Calendar className="h-3 w-3 text-[#00e054]" />
            <span className="font-mono text-[#ccdde6]">{totalFilms}</span> films
          </div>

          <div className="hidden sm:flex items-center gap-1 rounded bg-[#14181c] px-2 py-0.5 border border-[#2c3440]">
            <span className="h-2 w-2 rounded-full bg-[#00e054]" />
            <span>Metadata Coverage: <span className="font-mono text-[#ccdde6]">{matchedCount}/{totalFilms}</span></span>
          </div>
        </div>
      </div>
    </div>
  );
};
