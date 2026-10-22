import React, { useRef, useEffect } from 'react';
import { HeatmapDayCell } from '../../services/analytics/types.ts';
import { getTodayCalendarDate } from '../../utils/date.ts';

interface CalendarHeatmapProps {
  days: HeatmapDayCell[];
  onSelectDay: (cell: HeatmapDayCell) => void;
}

export const CalendarHeatmap: React.FC<CalendarHeatmapProps> = ({ days, onSelectDay }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const todayStr = getTodayCalendarDate();

  useEffect(() => {
    // Automatically scroll to today on mobile
    if (containerRef.current) {
      containerRef.current.scrollLeft = containerRef.current.scrollWidth;
    }
  }, []);

  // Organize 365 days into weeks (columns of 7 days: 1=Mon to 7=Sun)
  const weeks: HeatmapDayCell[][] = [];
  let currentWeek: HeatmapDayCell[] = [];

  // Pad the first week if day 1 is not Monday
  const firstDay = days[0];
  if (firstDay && firstDay.weekday > 1) {
    for (let i = 1; i < firstDay.weekday; i++) {
      currentWeek.push({
        date: '',
        count: 0,
        weekday: i,
        month: firstDay.month,
        year: firstDay.year,
        filmKeys: []
      });
    }
  }

  days.forEach((day) => {
    currentWeek.push(day);
    if (day.weekday === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });

  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  // Color ramp based on film watch count
  const getColor = (count: number): string => {
    if (count === 0) return '#1b2026';
    if (count === 1) return '#006d32';
    if (count === 2) return '#26a641';
    if (count >= 3) return '#00e054';
    return '#1b2026';
  };

  return (
    <div className="w-full">
      <div
        ref={containerRef}
        className="w-full overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-[#2c3440]"
      >
        <div className="min-w-[700px] flex flex-col gap-1.5">
          {/* Heatmap Grid (7 rows, N columns) */}
          <div className="flex gap-1">
            {/* Weekday labels */}
            <div className="flex flex-col justify-between pr-2 text-[10px] text-[#99aabb]/60 select-none">
              <span>Mon</span>
              <span>Wed</span>
              <span>Fri</span>
              <span>Sun</span>
            </div>

            {/* Weeks */}
            <div className="flex gap-1">
              {weeks.map((week, wIdx) => (
                <div key={wIdx} className="flex flex-col gap-1">
                  {week.map((cell, dIdx) => {
                    if (!cell.date) {
                      return <div key={dIdx} className="h-3 w-3 rounded-sm opacity-0" />;
                    }

                    const isToday = cell.date === todayStr;

                    return (
                      <button
                        key={dIdx}
                        onClick={() => onSelectDay(cell)}
                        data-testid={isToday ? 'calendar-cell-today' : undefined}
                        className={`h-3 w-3 rounded-sm transition-transform hover:scale-125 hover:z-10 focus:outline-none ${
                          isToday
                            ? 'ring-2 ring-[#e5a00d] ring-offset-1 ring-offset-[#14181c] shadow-[0_0_8px_rgba(229,160,13,0.8)]'
                            : ''
                        }`}
                        style={{
                          backgroundColor: getColor(cell.count),
                          ...(isToday ? { borderColor: '#ffd700', borderWidth: '1px' } : {})
                        }}
                        title={`${cell.date}${isToday ? ' (Today)' : ''}: ${cell.count} films watched`}
                        aria-label={`${cell.date}${isToday ? ' (Today)' : ''}: ${cell.count} films watched`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-[#99aabb]">
            <span>Less</span>
            <div className="h-2.5 w-2.5 rounded-sm bg-[#1b2026] border border-[#2c3440]" />
            <div className="h-2.5 w-2.5 rounded-sm bg-[#006d32]" />
            <div className="h-2.5 w-2.5 rounded-sm bg-[#26a641]" />
            <div className="h-2.5 w-2.5 rounded-sm bg-[#00e054]" />
            <span>More</span>
          </div>
        </div>
      </div>
    </div>
  );
};
