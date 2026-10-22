import React from 'react';
import { S11WordsTagsLists } from '../../services/analytics/types.ts';
import { MessageSquare, Tag, ListFilter, Star } from 'lucide-react';

interface S11WordsTagsSectionProps {
  wordsLists: S11WordsTagsLists;
}

export const S11WordsTagsSection: React.FC<S11WordsTagsSectionProps> = ({ wordsLists }) => {
  return (
    <section id="s11-words" className="space-y-6">
      <div className="border-b border-[#2c3440] pb-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#00e054]">
          Section 11 • Words, Tags & Lists
        </div>
        <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
          Written Reviews & Curated Lists
        </h2>
        <p className="mt-1 text-xs text-[#99aabb]">
          Textual frequency analysis of your logged reviews, tag affinities, and custom list completion rates.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Reviews Analysis (1 col) */}
        <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
            <MessageSquare className="h-4 w-4 text-[#40bcf4]" />
            <span>Review Vocabulary</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded-lg border border-[#2c3440] bg-[#14181c] p-2.5">
              <div className="text-[#99aabb]">Total Words</div>
              <div className="mt-0.5 font-display text-lg font-bold text-white">
                {wordsLists.totalWords.toLocaleString()}
              </div>
            </div>

            <div className="rounded-lg border border-[#2c3440] bg-[#14181c] p-2.5">
              <div className="text-[#99aabb]">Avg Words/Review</div>
              <div className="mt-0.5 font-display text-lg font-bold text-[#40bcf4]">
                {wordsLists.avgWordsPerReview}
              </div>
            </div>
          </div>

          {/* Word Cloud / Frequency Pills */}
          <div>
            <div className="text-xs font-semibold text-white mb-2">Most Used Words (Stopword Filtered)</div>
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
              {wordsLists.topWords.slice(0, 20).map((item) => (
                <span
                  key={item.word}
                  className="rounded bg-[#14181c] border border-[#2c3440] px-2 py-1 text-xs text-[#ccdde6]"
                >
                  {item.word} <span className="font-mono text-[10px] text-[#00e054]">({item.count})</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Tags Affinities (1 col) */}
        <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
            <Tag className="h-4 w-4 text-[#ff8000]" />
            <span>Top Diary Tags</span>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {wordsLists.tags.slice(0, 15).map((t) => (
              <div
                key={t.tag}
                className="flex items-center justify-between rounded-lg border border-[#2c3440] bg-[#14181c] p-2 text-xs"
              >
                <span className="font-semibold text-white">#{t.tag}</span>
                <div className="flex items-center space-x-2">
                  <span className="text-[#99aabb] font-mono">{t.count} films</span>
                  {t.avgRating > 0 && (
                    <div className="flex items-center gap-0.5 rounded bg-[#222831] px-1.5 py-0.5 text-[10px] font-bold text-[#ff8000]">
                      <Star className="h-2.5 w-2.5 fill-current" />
                      <span>{t.avgRating.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Lists Completion Progress (1 col) */}
        <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
            <ListFilter className="h-4 w-4 text-[#00e054]" />
            <span>Curated Lists Progress</span>
          </div>

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {wordsLists.listsProgress.map((list) => (
              <div key={list.slug} className="space-y-1 rounded-lg border border-[#2c3440] bg-[#14181c] p-3 text-xs">
                <div className="flex justify-between font-semibold text-white">
                  <span className="truncate pr-2">{list.name}</span>
                  <span className="font-mono text-[#00e054]">{list.percentSeen}%</span>
                </div>

                <div className="h-2 w-full rounded-full bg-[#1b2026] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#00e054] transition-all"
                    style={{ width: `${list.percentSeen}%` }}
                  />
                </div>

                <div className="flex justify-between text-[10px] text-[#99aabb] pt-0.5">
                  <span>Seen {list.seenItems} of {list.totalItems}</span>
                  <span>{list.totalItems - list.seenItems} remaining</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
