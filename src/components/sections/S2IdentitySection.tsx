import React from 'react';
import { S2Identity } from '../../services/analytics/types.ts';
import { Sparkles, CheckCircle2 } from 'lucide-react';

interface S2IdentitySectionProps {
  identity: S2Identity;
}

export const S2IdentitySection: React.FC<S2IdentitySectionProps> = ({ identity }) => {
  return (
    <section id="s2-identity" className="space-y-6">
      <div className="border-b border-[#2c3440] pb-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#00e054]">
          Section 02 • Film Identity
        </div>
        <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
          Your Cinema Archetype & Insights
        </h2>
        <p className="mt-1 text-xs text-[#99aabb]">
          Data-driven personality archetypes with rule-based criteria and headline viewing insights.
        </p>
      </div>

      {/* Archetype Badges Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {identity.archetypes.map((archetype) => (
          <div
            key={archetype.id}
            className="flex flex-col justify-between rounded-xl border border-[#00e054]/40 bg-[#1b2026] p-5 shadow-lg relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 h-16 w-16 bg-[#00e054]/5 rounded-bl-full pointer-events-none" />

            <div>
              <div className="flex items-center justify-between">
                <span className="font-display text-lg font-bold text-white">
                  {archetype.name}
                </span>
                <div className="flex items-center gap-1 rounded bg-[#00e054]/10 px-2 py-0.5 text-[10px] font-bold text-[#00e054] border border-[#00e054]/20">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Unlocked</span>
                </div>
              </div>

              <p className="mt-2 text-xs text-[#ccdde6] leading-relaxed">
                {archetype.description}
              </p>
            </div>

            <div className="mt-4 border-t border-[#2c3440] pt-3 text-[11px] text-[#99aabb]">
              <div className="flex justify-between">
                <span>Rule Criteria:</span>
                <span className="font-mono text-white">{archetype.thresholdLabel}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span>Your Data:</span>
                <span className="font-mono text-[#00e054] font-semibold">{archetype.valueLabel}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Insights Strip */}
      {identity.insights.length > 0 && (
        <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
            <Sparkles className="h-4 w-4 text-[#ff8000]" />
            <span>Computed Data Insights</span>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {identity.insights.map((insight) => (
              <div
                key={insight.id}
                className="rounded-lg border border-[#2c3440] bg-[#14181c] p-4 text-xs"
              >
                <div className="font-semibold text-white text-sm leading-snug">
                  {insight.headline}
                </div>
                <p className="mt-1 text-[#99aabb] leading-relaxed">
                  {insight.evidence}
                </p>
                <div className="mt-2 flex items-center justify-between text-[10px] text-[#99aabb]/60 pt-2 border-t border-[#2c3440]">
                  <span>Evidence Sample: n={insight.sampleSize}</span>
                  <span className="capitalize">{insight.category}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
