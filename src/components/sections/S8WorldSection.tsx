import React from 'react';
import { S8World } from '../../services/analytics/types.ts';
import { WorldRanking } from '../charts/WorldRanking.tsx';

interface S8WorldSectionProps {
  world: S8World;
  onSelectGroup: (name: string, filmKeys: string[]) => void;
}

export const S8WorldSection: React.FC<S8WorldSectionProps> = ({ world, onSelectGroup }) => {
  const nonEnglishShare = world.nonEnglishShareByYear[0]?.nonEnglishPercent || 0;

  return (
    <section id="s8-world" className="space-y-6">
      <div className="border-b border-[#2c3440] pb-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#00e054]">
          Section 08 • World
        </div>
        <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
          Global Geography & Languages
        </h2>
        <p className="mt-1 text-xs text-[#99aabb]">
          Ranked production origins, spoken languages, and your international vs domestic viewing balance.
        </p>
      </div>

      <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-6 shadow-xl">
        <WorldRanking
          countries={world.countries}
          languages={world.languages}
          nonEnglishShare={nonEnglishShare}
          onSelectGroup={onSelectGroup}
        />
      </div>
    </section>
  );
};
