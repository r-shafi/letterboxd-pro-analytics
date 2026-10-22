import React from 'react';
import { S7People, RankedPerson } from '../../services/analytics/types.ts';
import { PeoplePortraits } from '../charts/PeoplePortraits.tsx';
import { Compass, Link2 } from 'lucide-react';

interface S7PeopleSectionProps {
  people: S7People;
  overallMean: number;
  onSelectPerson: (person: RankedPerson, role: string) => void;
}

export const S7PeopleSection: React.FC<S7PeopleSectionProps> = ({
  people,
  overallMean,
  onSelectPerson
}) => {
  return (
    <section id="s7-people" className="space-y-6">
      <div className="border-b border-[#2c3440] pb-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#00e054]">
          Section 07 • People
        </div>
        <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
          Filmmakers, Cast & Crew
        </h2>
        <p className="mt-1 text-xs text-[#99aabb]">
          Ranked rankings of your most-viewed directors, actors, writers, composers, cinematographers, and collaborations.
        </p>
      </div>

      {/* Main People Portraits Carousel */}
      <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Top Cast & Crew</h3>
          <span className="text-xs text-[#99aabb]">Tap any portrait to open filmography</span>
        </div>

        <PeoplePortraits
          directors={people.directors}
          actors={people.actors}
          writers={people.writers}
          cinematographers={people.cinematographers}
          composers={people.composers}
          overallMean={overallMean}
          onSelectPerson={onSelectPerson}
        />
      </div>

      {/* Discovery & Collaborations Row */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Discovery stats */}
        <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
            <Compass className="h-4 w-4 text-[#00e054]" />
            <span>Director Discovery & Breadth</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-lg border border-[#2c3440] bg-[#14181c] p-3">
              <div className="text-xs text-[#99aabb]">Unique Directors</div>
              <div className="mt-1 font-display text-2xl font-black text-white">
                {people.uniqueDirectorsCount}
              </div>
            </div>

            <div className="rounded-lg border border-[#2c3440] bg-[#14181c] p-3">
              <div className="text-xs text-[#99aabb]">Single-Film Share</div>
              <div className="mt-1 font-display text-2xl font-black text-[#40bcf4]">
                {people.singleFilmDirectorsShare}%
              </div>
            </div>
          </div>

          <p className="text-xs text-[#ccdde6] leading-relaxed">
            {people.singleFilmDirectorsShare >= 60
              ? 'You have an exploratory palate, continually sampling new cinematic voices.'
              : 'You have strong loyalty to beloved directors, frequently watching complete filmographies.'}
          </p>
        </div>

        {/* Director-Actor recurring collaboration pairs */}
        <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-6 shadow-xl space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
            <Link2 className="h-4 w-4 text-[#ff8000]" />
            <span>Frequent Director-Actor Collaborations</span>
          </div>

          <div className="space-y-2 text-xs">
            {people.directorActorPairs.slice(0, 5).map((pair, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-lg border border-[#2c3440] bg-[#14181c] p-2.5"
              >
                <div>
                  <span className="font-semibold text-white">{pair.directorName}</span>
                  <span className="text-[#99aabb]"> &amp; </span>
                  <span className="font-semibold text-white">{pair.actorName}</span>
                </div>
                <span className="font-mono text-[11px] font-bold text-[#00e054]">
                  {pair.pairCount} films
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
