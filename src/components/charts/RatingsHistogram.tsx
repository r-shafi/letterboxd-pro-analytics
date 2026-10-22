import React from 'react';
import { RatingBucket } from '../../services/analytics/types.ts';
import { Star } from 'lucide-react';

interface RatingsHistogramProps {
  histogram: RatingBucket[];
  onSelectRating?: (rating: number) => void;
}

export const RatingsHistogram: React.FC<RatingsHistogramProps> = ({
  histogram,
  onSelectRating
}) => {
  const maxCount = Math.max(1, ...histogram.map((h) => h.count));

  return (
    <div className="w-full space-y-2">
      <div className="grid grid-cols-10 gap-1.5 sm:gap-2 h-44 items-end pt-6">
        {histogram.map((bucket) => {
          const heightPercent = Math.max(4, Math.round((bucket.count / maxCount) * 100));

          return (
            <button
              key={bucket.rating}
              onClick={() => onSelectRating?.(bucket.rating)}
              className="group flex flex-col items-center h-full justify-end focus:outline-none"
              title={`${bucket.rating}★: ${bucket.count} films (${bucket.percent}%)`}
              aria-label={`${bucket.rating} stars: ${bucket.count} films`}
            >
              {/* Count label above bar */}
              <span className="text-[10px] font-mono text-[#99aabb] opacity-0 group-hover:opacity-100 transition-opacity mb-1">
                {bucket.count}
              </span>

              {/* Bar */}
              <div
                className="w-full rounded-t transition-all duration-300 bg-[#00e054] group-hover:bg-[#00c047] group-hover:brightness-110"
                style={{ height: `${heightPercent}%` }}
              />

              {/* Star rating label below */}
              <div className="mt-2 flex items-center justify-center gap-0.5 text-[10px] font-medium text-[#99aabb]">
                <span>{bucket.rating}</span>
                <Star className="h-2.5 w-2.5 fill-[#00e054] text-[#00e054]" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
