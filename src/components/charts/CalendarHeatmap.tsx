import React, { useRef, useEffect } from 'react';
import { HeatmapDayCell } from '../../services/analytics/types.ts';
import { getTodayCalendarDate } from '../../utils/date.ts';

interface CalendarHeatmapProps {
  days: HeatmapDayCell[];
  onSelectDay: (cell: HeatmapDayCell) => void;
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export const CalendarHeatmap: React.FC<CalendarHeatmapProps> = ({ days, onSelectDay }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const todayStr = getTodayCalendarDate();

  useEffect(() => {
    // Automatically scroll to today on mobile
    if (containerRef.current) {
      containerRef.current.scrollLeft = containerRef.current.scrollWidth;
    }
  }, []);

  // Organize days into weeks (columns of 7 days: 1=Mon to 7=Sun)
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

  // Determine month labels for each week column
  const monthHeaders: Array<{ label: string; colIndex: number }> = [];
  let lastMonth = -1;

  weeks.forEach((week, wIdx) => {
    // Find the first valid date in this week
    const validDay = week.find((d) => Boolean(d.date));
    if (validDay && validDay.month !== lastMonth) {
      monthHeaders.push({
        label: MONTH_NAMES[validDay.month - 1],
        colIndex: wIdx
      });
      lastMonth = validDay.month;
    }
  });

  // Color ramp based on film watch count with high contrast and explicit borders
  const getColor = (count: number): { bg: string; border: string } => {
    if (count === 0) return { bg: '#222832', border: '#2f3846' };
    if (count === 1) return { bg: '#15803d', border: '#16a34a' }; // High contrast emerald
    if (count === 2) return { bg: '#16a34a', border: '#22c55e' }; // Mid green
    return { bg: '#00e054', border: '#4ade80' }; // Vibrant max green
  };

  return (
    <div className="w-full">
      <div
        ref={containerRef}
        className="w-full overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-[#2c3440]"
      >
        <div className="min-w-[720px] flex flex-col gap-1.5">
          {/* Month Labels Row */}
          <div className="flex text-[10px] text-[#99aabb] font-medium select-none mb-1" data-testid="calendar-month-headers">
            {/* Left offset for weekday column */}
            <div className="w-7 shrink-0" />

            {/* Weeks month labels */}
            <div className="flex gap-1">
              {weeks.map((_, wIdx) => {
                const header = monthHeaders.find((m) => m.colIndex === wIdx);
                return (
                  <div key={wIdx} className="w-3 text-left overflow-visible whitespace-nowrap">
                    {header && <span>{header.label}</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Heatmap Grid (7 rows, N columns) */}
          <div className="flex gap-1 items-start">
            {/* Weekday labels */}
            <div className="w-7 shrink-0 flex flex-col justify-between h-[108px] text-[10px] text-[#99aabb]/70 select-none pr-1">
              <span>Mon</span>
              <span>Wed</span>
              <span>Fri</span>
              <span>Sun</span>
            </div>

            {/* Weeks */}
            <div className="flex gap-1" data-testid="calendar-grid">
              {weeks.map((week, wIdx) => (
                <div key={wIdx} className="flex flex-col gap-1">
                  {week.map((cell, dIdx) => {
                    if (!cell.date) {
                      return (
                        <div
                          key={dIdx}
                          className="h-3 w-3 rounded-sm opacity-0 pointer-events-none"
                          data-testid="calendar-cell-pad"
                        />
                      );
                    }

                    const isToday = cell.date === todayStr;
                    const { bg, border } = getColor(cell.count);

                    return (
                      <button
                        key={dIdx}
                        onClick={() => onSelectDay(cell)}
                        data-testid={isToday ? 'calendar-cell-today' : `calendar-cell-${cell.date}`}
                        data-count={cell.count}
                        className={`h-3 w-3 rounded-sm transition-transform hover:scale-125 hover:z-10 focus:outline-none ${
                          isToday
                            ? 'ring-2 ring-[#e5a00d] ring-offset-1 ring-offset-[#14181c] shadow-[0_0_8px_rgba(229,160,13,0.8)]'
                            : ''
                        }`}
                        style={{
                          backgroundColor: bg,
                          border: isToday ? '1px solid #ffd700' : `1px solid ${border}`
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

          {/* Legend: matching grid rounded squares */}
          <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-[#99aabb]" data-testid="calendar-legend">
            <span>Less</span>
            <div
              className="h-3 w-3 rounded-sm"
              style={{ backgroundColor: '#222832', border: '1px solid #2f3846' }}
              title="0 films"
            />
            <div
              className="h-3 w-3 rounded-sm"
              style={{ backgroundColor: '#15803d', border: '1px solid #16a34a' }}
              title="1 film"
            />
            <div
              className="h-3 w-3 rounded-sm"
              style={{ backgroundColor: '#16a34a', border: '1px solid #22c55e' }}
              title="2 films"
            />
            <div
              className="h-3 w-3 rounded-sm"
              style={{ backgroundColor: '#00e054', border: '1px solid #4ade80' }}
              title="3+ films"
            />
            <span>More</span>
          </div>
        </div>
      </div>
    </div>
  );
};
