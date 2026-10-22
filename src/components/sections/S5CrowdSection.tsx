import React from 'react';
import { S5CrowdComparison } from '../../services/analytics/types.ts';
import { CrowdScatter } from '../charts/CrowdScatter.tsx';

interface S5CrowdSectionProps {
  crowd: S5CrowdComparison;
  onSelectFilm: (filmKey: string) => void;
}

export const S5CrowdSection: React.FC<S5CrowdSectionProps> = ({ crowd, onSelectFilm }) => {
  return (
    <section id="s5-crowd" className="space-y-6">
      <div className="border-b border-[#2c3440] pb-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#00e054]">
          Section 05 • Crowd Comparison
        </div>
        <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
          You vs Global Consensus
        </h2>
        <p className="mt-1 text-xs text-[#99aabb]">
          Correlation, mean divergence, and your boldest rating disagreements against millions of global movie fans.
        </p>
      </div>

      <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-6 shadow-xl">
        <CrowdScatter
          scatterPoints={crowd.scatterPoints}
          correlationR={crowd.correlationR}
          meanDelta={crowd.meanDelta}
          biggestOverrates={crowd.biggestOverrates}
          biggestUnderrates={crowd.biggestUnderrates}
          onSelectFilm={onSelectFilm}
        />
      </div>
    </section>
  );
};
