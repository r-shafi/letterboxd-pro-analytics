import React from 'react';
import { S6TasteProfile } from '../../services/analytics/types.ts';
import { TasteAffinityChart } from '../charts/TasteAffinityChart.tsx';
import { Compass, Clock } from 'lucide-react';

interface S6TasteSectionProps {
  taste: S6TasteProfile;
  overallMean: number;
}

export const S6TasteSection: React.FC<S6TasteSectionProps> = ({ taste, overallMean }) => {
  return (
    <section id="s6-taste" className="space-y-6">
      <div className="border-b border-[#2c3440] pb-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#00e054]">
          Section 06 • Taste Profile & Evolution
        </div>
        <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
          Taste Affinities & Preferences
        </h2>
        <p className="mt-1 text-xs text-[#99aabb]">
          Bayesian-smoothed preference deltas, mainstream vs obscure balance, runtime sweet-spots, and diversity entropy.
        </p>
      </div>

      {/* Main Taste Affinities Diverging Bars */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Affinities (2 cols) */}
        <div className="lg:col-span-2 rounded-xl border border-[#2c3440] bg-[#1b2026] p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">Rating Affinity vs Baseline</h3>
            <span className="text-xs text-[#00e054] font-medium">Smoothed Relative &Delta;</span>
          </div>

          <TasteAffinityChart
            genreAffinity={taste.genreAffinity}
            decadeAffinity={taste.decadeAffinity}
            countryAffinity={taste.countryAffinity}
            languageAffinity={taste.languageAffinity}
            overallMean={overallMean}
          />
        </div>

        {/* Supporting Stats (1 col): Hipster & Runtime */}
        <div className="space-y-6">
          {/* Mainstream vs Obscure / Hipster Index */}
          <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-6 shadow-xl space-y-3">
            <div className="flex items-center justify-between text-[#99aabb]">
              <span className="text-[11px] font-semibold uppercase tracking-wider">The Hipster Index</span>
              <Compass className="h-4 w-4 text-[#40bcf4]" />
            </div>

            <div className="font-display text-3xl font-extrabold text-[#40bcf4]">
              {taste.hipsterIndex}%
            </div>

            <p className="text-xs text-[#ccdde6] leading-relaxed">
              Percentage of films in your library with low TMDb popularity (&lt; 15).
              {taste.hipsterIndex >= 30
                ? ' You frequently venture deep into indie and arthouse cinema.'
                : ' You gravitate primarily towards widely recognized releases.'}
            </p>
          </div>

          {/* Runtime Sweet-Spot */}
          <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-6 shadow-xl space-y-3">
            <div className="flex items-center justify-between text-[#99aabb]">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Runtime Preference</span>
              <Clock className="h-4 w-4 text-[#00e054]" />
            </div>

            <div className="space-y-2 text-xs pt-1">
              {taste.runtimePreferences.map((r) => (
                <div key={r.bucket} className="flex items-center justify-between p-2 rounded bg-[#14181c] border border-[#2c3440]">
                  <span className="text-white font-medium">{r.bucket}</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-[#99aabb] font-mono">{r.count} films</span>
                    {r.avgRating > 0 && (
                      <span className="font-mono font-bold text-[#00e054]">{r.avgRating}★</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
