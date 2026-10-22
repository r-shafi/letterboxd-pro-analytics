import React from 'react';
import { Sparkles, Share2 } from 'lucide-react';

interface S14ShareSectionProps {
  onOpenShareModal: () => void;
}

export const S14ShareSection: React.FC<S14ShareSectionProps> = ({ onOpenShareModal }) => {
  return (
    <section id="s14-share" className="space-y-6">
      <div className="border-b border-[#2c3440] pb-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#00e054]">
          Section 14 • Social Share & Year in Review
        </div>
        <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
          Share Your Cinema Journey
        </h2>
        <p className="mt-1 text-xs text-[#99aabb]">
          Generate bespoke social cards (1:1 square posts and 9:16 vertical stories) rendered entirely in your browser.
        </p>
      </div>

      <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-8 text-center shadow-xl space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#00e054]/10 border border-[#00e054]/30 text-[#00e054]">
          <Sparkles className="h-7 w-7" />
        </div>

        <h3 className="font-display text-xl font-bold text-white">
          Export Your Customized Share Graphic
        </h3>

        <p className="mx-auto max-w-md text-xs text-[#ccdde6] leading-relaxed">
          Create high-resolution images of your headline viewing stats, top director and actor, archetype badge, and favorite genres.
        </p>

        <div className="pt-2">
          <button
            onClick={onOpenShareModal}
            className="inline-flex items-center gap-2 rounded-xl bg-[#00e054] px-6 py-3 font-display font-bold text-sm text-[#14181c] shadow-lg hover:bg-[#00c047] hover:scale-105 active:scale-95 transition-all"
          >
            <Share2 className="h-4 w-4" />
            <span>Generate Share Card</span>
          </button>
        </div>

        <div className="text-[11px] text-[#99aabb]/60 pt-2">
          100% Client-Side. No images or stats are ever uploaded to any server.
        </div>
      </div>
    </section>
  );
};
