import React, { useState, useRef } from 'react';
import { RankedPerson } from '../../services/analytics/types.ts';
import { CONFIG } from '../../config/env.ts';
import { Star } from 'lucide-react';
import { PosterImage } from '../common/PosterImage.tsx';

interface PeoplePortraitsProps {
  directors: RankedPerson[];
  actors: RankedPerson[];
  actresses: RankedPerson[];
  allCast?: RankedPerson[];
  writers: RankedPerson[];
  cinematographers: RankedPerson[];
  composers: RankedPerson[];
  overallMean: number;
  onSelectPerson: (person: RankedPerson, role: string) => void;
}

type Role = 'directors' | 'actors' | 'actresses' | 'writers' | 'cinematographers' | 'composers';

const ROLES: { id: Role; label: string }[] = [
  { id: 'directors', label: 'Directors' },
  { id: 'actors', label: 'Actors' },
  { id: 'actresses', label: 'Actresses' },
  { id: 'writers', label: 'Writers' },
  { id: 'cinematographers', label: 'Cinematographers' },
  { id: 'composers', label: 'Composers' }
];

export const PeoplePortraits: React.FC<PeoplePortraitsProps> = ({
  directors,
  actors,
  actresses,
  writers,
  cinematographers,
  composers,
  overallMean,
  onSelectPerson
}) => {
  const [activeRole, setActiveRole] = useState<Role>('directors');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleRoleChange = (role: Role) => {
    setActiveRole(role);
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
      : activeRole === 'actors'
      ? actors
      : activeRole === 'actresses'
      ? actresses
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
      <div className="flex flex-wrap items-center gap-2 border-b border-[#2c3440] pb-2 text-xs">
        <div className="flex overflow-x-auto gap-2">
          {ROLES.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => handleRoleChange(id)}
              className={`rounded-full px-3 py-1 font-medium transition-colors whitespace-nowrap ${
                activeRole === id
                  ? 'bg-[#00e054] text-[#14181c] font-bold shadow'
                  : 'text-[#99aabb] hover:text-white bg-[#14181c] border border-[#2c3440]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Horizontally scrollable circular portrait row */}
      <div
        ref={scrollContainerRef}
        className="flex gap-4 overflow-x-auto pb-4 pt-1 scrollbar-thin scrollbar-thumb-[#2c3440]"
      >
        {currentList.length === 0 ? (
          <div className="py-6 text-xs text-[#99aabb] italic">
            No {activeRole} found in this library.
          </div>
        ) : (
          currentList.slice(0, 20).map((item, idx) => {
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
                    <PosterImage
                      src={item.person.profilePath ? `${CONFIG.tmdbImageBase}/w185${item.person.profilePath}` : null}
                      alt={item.person.name}
                      className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-300"
                      fallbackIcon={
                        <div className="flex h-full w-full items-center justify-center font-display font-bold text-sm text-[#99aabb]">
                          {getInitials(item.person.name)}
                        </div>
                      }
                      loading="lazy"
                    />
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
          })
        )}
      </div>
    </div>
  );
};
