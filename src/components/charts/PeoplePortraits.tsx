import React, { useState, useRef } from 'react';
import { RankedPerson } from '../../services/analytics/types.ts';
import { CONFIG } from '../../config/env.ts';
import { Star } from 'lucide-react';

interface PeoplePortraitsProps {
  directors: RankedPerson[];
  actors: RankedPerson[];
  actresses: RankedPerson[];
  allCast: RankedPerson[];
  writers: RankedPerson[];
  cinematographers: RankedPerson[];
  composers: RankedPerson[];
  overallMean: number;
  onSelectPerson: (person: RankedPerson, role: string) => void;
}

export const PeoplePortraits: React.FC<PeoplePortraitsProps> = ({
  directors,
  actors,
  actresses,
  allCast,
  writers,
  cinematographers,
  composers,
  overallMean,
  onSelectPerson
}) => {
  const [activeRole, setActiveRole] = useState<'directors' | 'cast' | 'writers' | 'cinematographers' | 'composers'>('directors');
  const [castSubFilter, setCastSubFilter] = useState<'all' | 'actors' | 'actresses'>('all');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleRoleChange = (role: 'directors' | 'cast' | 'writers' | 'cinematographers' | 'composers') => {
    setActiveRole(role);
    if (typeof scrollContainerRef.current?.scrollTo === 'function') {
      scrollContainerRef.current.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
    } else if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = 0;
      scrollContainerRef.current.scrollTop = 0;
    }
  };

  const handleCastFilterChange = (filter: 'all' | 'actors' | 'actresses') => {
    setCastSubFilter(filter);
    if (typeof scrollContainerRef.current?.scrollTo === 'function') {
      scrollContainerRef.current.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
    } else if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = 0;
      scrollContainerRef.current.scrollTop = 0;
    }
  };

  const currentList =
    activeRole === 'directors'
      ? directors
      : activeRole === 'cast'
      ? (castSubFilter === 'actors' ? actors : castSubFilter === 'actresses' ? actresses : allCast)
      : activeRole === 'writers'
      ? writers
      : activeRole === 'cinematographers'
      ? cinematographers
      : composers;

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  };

  return (
    <div className="w-full space-y-4">
      {/* Role Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2c3440] pb-2 text-xs">
        <div className="flex overflow-x-auto gap-2">
          {(['directors', 'cast', 'writers', 'cinematographers', 'composers'] as const).map((role) => (
            <button
              key={role}
              onClick={() => handleRoleChange(role)}
              className={`rounded-full px-3 py-1 font-medium capitalize transition-colors whitespace-nowrap ${
                activeRole === role
                  ? 'bg-[#00e054] text-[#14181c] font-bold shadow'
                  : 'text-[#99aabb] hover:text-white bg-[#14181c] border border-[#2c3440]'
              }`}
            >
              {role === 'cast' ? 'Cast' : role}
            </button>
          ))}
        </div>

        {/* Cast Sub-Filter (All Cast / Actors / Actresses) */}
        {activeRole === 'cast' && (
          <div className="flex items-center gap-1 rounded-lg bg-[#14181c] p-1 border border-[#2c3440]">
            {(
              [
                { id: 'all', label: 'All Cast' },
                { id: 'actors', label: 'Actors' },
                { id: 'actresses', label: 'Actresses' }
              ] as const
            ).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => handleCastFilterChange(id)}
                className={`rounded px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                  castSubFilter === id
                    ? 'bg-[#2c3440] text-white font-bold'
                    : 'text-[#99aabb] hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Horizontally scrollable circular portrait row */}
      <div
        ref={scrollContainerRef}
        className="flex gap-4 overflow-x-auto pb-4 pt-1 scrollbar-thin scrollbar-thumb-[#2c3440]"
      >
        {currentList.slice(0, 20).map((item, idx) => {
          const isAbove = item.avgRating >= overallMean;

          return (
            <button
              key={item.person.id}
              onClick={() => onSelectPerson(item, activeRole)}
              className="flex flex-col items-center shrink-0 w-24 group focus:outline-none text-center"
            >
              {/* Circular portrait avatar */}
              <div className="relative">
                <div className="h-16 w-16 rounded-full overflow-hidden border-2 border-[#2c3440] group-hover:border-[#00e054] transition-all bg-[#1b2026] shadow">
                  {item.person.profilePath ? (
                    <img
                      src={`${CONFIG.tmdbImageBase}/w185${item.person.profilePath}`}
                      alt={item.person.name}
                      className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center font-display font-bold text-sm text-[#99aabb]">
                      {getInitials(item.person.name)}
                    </div>
                  )}
                </div>

                {/* Rank badge */}
                <div className="absolute -top-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#1b2026] border border-[#2c3440] text-[10px] font-bold text-white shadow">
                  {idx + 1}
                </div>
              </div>

              {/* Name & Counts */}
              <div className="mt-2 text-xs font-semibold text-white line-clamp-1 group-hover:text-[#00e054] transition-colors">
                {item.person.name}
              </div>
              <div className="text-[10px] text-[#99aabb]">
                {item.count} {item.count === 1 ? 'film' : 'films'}
              </div>

              {/* Rating chip */}
              {item.avgRating > 0 && (
                <div
                  className={`mt-1 flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                    isAbove ? 'bg-[#00e054]/10 text-[#00e054]' : 'bg-[#ff8000]/10 text-[#ff8000]'
                  }`}
                >
                  <Star className="h-2.5 w-2.5 fill-current" />
                  <span>{item.avgRating.toFixed(2)}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
