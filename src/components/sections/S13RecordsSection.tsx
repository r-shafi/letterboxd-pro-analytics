import React from 'react';
import { S13Records } from '../../services/analytics/types.ts';
import { Trophy, Clock, Calendar, TrendingUp, Zap } from 'lucide-react';

interface S13RecordsSectionProps {
  records: S13Records;
  onSelectFilm: (filmKey: string) => void;
}

export const S13RecordsSection: React.FC<S13RecordsSectionProps> = ({
  records,
  onSelectFilm
}) => {
  return (
    <section id="s13-records" className="space-y-6">
      <div className="border-b border-[#2c3440] pb-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#00e054]">
          Section 13 • Records & Quirks
        </div>
        <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
          Superlatives & Fun Facts
        </h2>
        <p className="mt-1 text-xs text-[#99aabb]">
          Extreme records, quirky milestones, and provably verified personal viewing statistics.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Longest Film */}
        {records.longestFilm && (
          <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-5 shadow flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-[#99aabb]">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Longest Film</span>
                <Clock className="h-4 w-4 text-[#40bcf4]" />
              </div>
              <button
                onClick={() => onSelectFilm(records.longestFilm!.letterboxdUri)}
                className="mt-2 font-display text-lg font-bold text-white hover:text-[#00e054] text-left line-clamp-1"
              >
                {records.longestFilm.name}
              </button>
            </div>
            <div className="mt-4 font-mono text-sm font-bold text-[#40bcf4]">
              {records.longestFilm.metadata?.runtime} minutes (~{Math.round((records.longestFilm.metadata?.runtime || 0) / 60)} hrs)
            </div>
          </div>
        )}

        {/* Shortest Film */}
        {records.shortestFilm && (
          <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-5 shadow flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-[#99aabb]">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Shortest Feature Film</span>
                <Clock className="h-4 w-4 text-[#00e054]" />
              </div>
              <button
                onClick={() => onSelectFilm(records.shortestFilm!.letterboxdUri)}
                className="mt-2 font-display text-lg font-bold text-white hover:text-[#00e054] text-left line-clamp-1"
              >
                {records.shortestFilm.name}
              </button>
            </div>
            <div className="mt-4 font-mono text-sm font-bold text-[#00e054]">
              {records.shortestFilm.metadata?.runtime} minutes
            </div>
          </div>
        )}

        {/* Oldest Film */}
        {records.oldestFilm && (
          <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-5 shadow flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-[#99aabb]">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Earliest Release</span>
                <Calendar className="h-4 w-4 text-[#ff8000]" />
              </div>
              <button
                onClick={() => onSelectFilm(records.oldestFilm!.letterboxdUri)}
                className="mt-2 font-display text-lg font-bold text-white hover:text-[#00e054] text-left line-clamp-1"
              >
                {records.oldestFilm.name}
              </button>
            </div>
            <div className="mt-4 font-mono text-sm font-bold text-[#ff8000]">
              Released {records.oldestFilm.year}
            </div>
          </div>
        )}

        {/* Peak Day */}
        {records.peakDayDate && (
          <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-5 shadow flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-[#99aabb]">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Peak Viewing Day</span>
                <Zap className="h-4 w-4 text-[#ff8000]" />
              </div>
              <div className="mt-2 font-display text-lg font-bold text-white font-mono">
                {records.peakDayDate}
              </div>
            </div>
            <div className="mt-4 font-mono text-sm font-bold text-[#ff8000]">
              {records.peakDayCount} films logged in 24 hours
            </div>
          </div>
        )}

        {/* Most Popular on TMDb */}
        {records.mostPopularFilm && (
          <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-5 shadow flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-[#99aabb]">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Most Popular TMDb Title</span>
                <TrendingUp className="h-4 w-4 text-[#00e054]" />
              </div>
              <button
                onClick={() => onSelectFilm(records.mostPopularFilm!.letterboxdUri)}
                className="mt-2 font-display text-lg font-bold text-white hover:text-[#00e054] text-left line-clamp-1"
              >
                {records.mostPopularFilm.name}
              </button>
            </div>
            <div className="mt-4 font-mono text-sm font-bold text-[#00e054]">
              {records.mostPopularFilm.metadata?.voteCount.toLocaleString()} crowd votes
            </div>
          </div>
        )}

        {/* Biggest Disagreement */}
        {records.biggestCrowdDisagreement && (
          <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-5 shadow flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-[#99aabb]">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Peak Crowd Divergence</span>
                <Trophy className="h-4 w-4 text-[#40bcf4]" />
              </div>
              <button
                onClick={() => onSelectFilm(records.biggestCrowdDisagreement!.film.letterboxdUri)}
                className="mt-2 font-display text-lg font-bold text-white hover:text-[#00e054] text-left line-clamp-1"
              >
                {records.biggestCrowdDisagreement.film.name}
              </button>
            </div>
            <div className="mt-4 font-mono text-sm font-bold text-[#40bcf4]">
              {records.biggestCrowdDisagreement.delta > 0
                ? `+${records.biggestCrowdDisagreement.delta}★ higher than consensus`
                : `${records.biggestCrowdDisagreement.delta}★ lower than consensus`}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
