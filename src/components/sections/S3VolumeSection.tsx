import React from 'react';
import { S3Volume, HeatmapDayCell } from '../../services/analytics/types.ts';
import { CalendarHeatmap } from '../charts/CalendarHeatmap.tsx';
import { Flame, Award, Zap, TrendingUp, Clock } from 'lucide-react';

interface S3VolumeSectionProps {
  volume: S3Volume;
  onSelectDay: (cell: HeatmapDayCell) => void;
  onSelectMarathon: (day: S3Volume['marathonDays'][0]) => void;
}

export const S3VolumeSection: React.FC<S3VolumeSectionProps> = ({
  volume,
  onSelectDay,
  onSelectMarathon
}) => {
  return (
    <section id="s3-volume" className="space-y-6">
      <div className="border-b border-[#2c3440] pb-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#00e054]">
          Section 03 • Volume & Rhythm
        </div>
        <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
          Viewing Velocity & Streaks
        </h2>
        <p className="mt-1 text-xs text-[#99aabb]">
          Activity distribution, calendar heatmap, streaks, pace projections, and movie marathons.
        </p>
      </div>

      {/* Streaks Banner */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Current Streak */}
        <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-4 shadow">
          <div className="flex items-center justify-between text-[#99aabb]">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Current Streak</span>
            <Flame className={`h-4 w-4 ${volume.streaks.isCurrentStreakActive ? 'text-[#ff8000]' : 'text-[#99aabb]'}`} />
          </div>
          <div className="mt-2 font-display text-3xl font-extrabold text-white">
            {volume.streaks.currentStreakDays} {volume.streaks.currentStreakDays === 1 ? 'day' : 'days'}
          </div>
          <div className="mt-1 text-[11px] text-[#99aabb]">
            {volume.streaks.isCurrentStreakActive ? (
              <span className="text-[#00e054] font-medium">● Alive & active today</span>
            ) : (
              <span>Inactive (watch today to start)</span>
            )}
          </div>
        </div>

        {/* Longest Streak */}
        <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-4 shadow">
          <div className="flex items-center justify-between text-[#99aabb]">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Longest Streak</span>
            <Award className="h-4 w-4 text-[#00e054]" />
          </div>
          <div className="mt-2 font-display text-3xl font-extrabold text-[#00e054]">
            {volume.streaks.longestStreakDays} {volume.streaks.longestStreakDays === 1 ? 'day' : 'days'}
          </div>
          <div className="mt-1 text-[11px] text-[#99aabb]">
            {volume.streaks.longestStreakStartDate} &rarr; {volume.streaks.longestStreakEndDate}
          </div>
        </div>

        {/* Longest Gap */}
        <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-4 shadow">
          <div className="flex items-center justify-between text-[#99aabb]">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Longest Gap</span>
            <Clock className="h-4 w-4 text-[#40bcf4]" />
          </div>
          <div className="mt-2 font-display text-3xl font-extrabold text-white">
            {volume.streaks.longestGapDays} days
          </div>
          <div className="mt-1 text-[11px] text-[#99aabb]">
            {volume.streaks.longestGapStartDate} &rarr; {volume.streaks.longestGapEndDate}
          </div>
        </div>
      </div>

      {/* 365-Day Activity Calendar Card */}
      <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Trailing 365-Day Activity</h3>
            <p className="text-xs text-[#99aabb]">
              Every day watched over the last 365 days ending today. Tap any cell to view films.
            </p>
          </div>
          {volume.busiestDay && (
            <div className="hidden sm:block text-right text-xs">
              <span className="text-[#99aabb]">Peak Day: </span>
              <span className="font-mono font-bold text-[#00e054]">{volume.busiestDay.date}</span>
              <span className="text-[#99aabb]"> ({volume.busiestDay.count} films)</span>
            </div>
          )}
        </div>

        <CalendarHeatmap
          days={volume.trailing365Calendar}
          onSelectDay={onSelectDay}
        />
      </div>

      {/* Yearly Volumes & Milestones */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Films per year */}
        <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-6 shadow-xl space-y-4">
          <h3 className="text-base font-bold text-white">Annual Film Volume</h3>
          <div className="space-y-3">
            {volume.yearlyVolume.map((y) => (
              <div key={y.year} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-white">{y.year}</span>
                  <span className="text-[#99aabb] font-mono">
                    {y.filmsCount} films • {Math.round(y.runtimeMinutes / 60)} hrs
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-[#14181c] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#00e054]"
                    style={{
                      width: `${Math.min(
                        100,
                        (y.filmsCount / Math.max(1, ...volume.yearlyVolume.map((item) => item.filmsCount))) * 100
                      )}%`
                    }}
                  />
                </div>
                {y.milestones.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {y.milestones.map((m) => (
                      <span
                        key={m.filmNumber}
                        className="rounded bg-[#ff8000]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#ff8000] border border-[#ff8000]/20"
                      >
                        {m.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Seasonality & Weekday breakdown */}
        <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-6 shadow-xl space-y-4">
          <h3 className="text-base font-bold text-white">Day of the Week Habits</h3>
          <div className="grid grid-cols-7 gap-1.5 items-end h-36 pt-4">
            {volume.weekdayDistribution.map((wd) => {
              const maxWd = Math.max(1, ...volume.weekdayDistribution.map((w) => w.count));
              const heightPct = Math.max(8, Math.round((wd.count / maxWd) * 100));

              return (
                <div key={wd.weekday} className="flex flex-col items-center h-full justify-end">
                  <span className="text-[10px] font-mono text-[#99aabb] mb-1">{wd.count}</span>
                  <div
                    className="w-full rounded-t bg-[#40bcf4] transition-all"
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className="mt-2 text-[10px] font-semibold text-[#ccdde6]">{wd.name}</span>
                </div>
              );
            })}
          </div>

          {/* Current Year Pace Projection */}
          <div className="mt-4 rounded-lg border border-[#2c3440] bg-[#14181c] p-3 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#00e054]" />
              <div>
                <span className="font-semibold text-white">Current Year Pace: </span>
                <span className="text-[#99aabb]">
                  Projected <strong className="text-[#00e054] font-mono">{volume.currentYearPace.projectedFilms}</strong> films by year-end
                </span>
              </div>
            </div>
            <span className="font-mono text-[#99aabb] text-[11px]">
              ({volume.currentYearPace.filmsSoFar} watched on day {volume.currentYearPace.dayOfYear})
            </span>
          </div>
        </div>
      </div>

      {/* Marathon Days */}
      {volume.marathonDays.length > 0 && (
        <div className="rounded-xl border border-[#2c3440] bg-[#1b2026] p-6 shadow-xl space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
            <Zap className="h-4 w-4 text-[#ff8000]" />
            <span>Movie Marathon Days (3+ Films or Longest Screenings)</span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
            {volume.marathonDays.slice(0, 10).map((day) => (
              <button
                key={day.date}
                onClick={() => onSelectMarathon(day)}
                className="rounded-lg border border-[#2c3440] bg-[#14181c] p-3 text-left hover:border-[#ff8000] transition-colors"
              >
                <div className="font-mono text-xs font-bold text-white">{day.date}</div>
                <div className="mt-1 font-display text-lg font-black text-[#ff8000]">
                  {day.count} films
                </div>
                {day.runtimeMinutes > 0 && (
                  <div className="text-[10px] text-[#99aabb]">
                    {Math.round(day.runtimeMinutes / 60)} hrs total
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
