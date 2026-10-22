import { describe, it, expect } from 'vitest';
import {
  parseCalendarDate,
  formatCalendarDate,
  daysBetween,
  addDays,
  getWeekday,
  isLeapYear,
  getDaysInMonth,
  formatWatchDuration
} from '../src/utils/date.ts';

describe('Calendar Date Helpers & Resilience', () => {
  it('identifies leap years accurately', () => {
    expect(isLeapYear(2020)).toBe(true);
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2023)).toBe(false);
  });

  it('determines days in months including leap years', () => {
    expect(getDaysInMonth(2024, 2)).toBe(29);
    expect(getDaysInMonth(2023, 2)).toBe(28);
    expect(getDaysInMonth(2024, 1)).toBe(31);
    expect(getDaysInMonth(2024, 4)).toBe(30);
  });

  it('parses valid calendar dates without timezone skew', () => {
    const res = parseCalendarDate('2026-10-20');
    expect(res).toEqual({ year: 2026, month: 10, day: 20 });
    expect(formatCalendarDate(2026, 10, 20)).toBe('2026-10-20');
  });

  it('rejects invalid calendar dates', () => {
    expect(parseCalendarDate('2023-02-29')).toBeNull(); // not a leap year
    expect(parseCalendarDate('2024-02-29')).not.toBeNull(); // leap year
    expect(parseCalendarDate('invalid-date')).toBeNull();
    expect(parseCalendarDate('')).toBeNull();
  });

  it('calculates days between across years and leap years', () => {
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2); // 2024 has Feb 29
    expect(daysBetween('2023-02-28', '2023-03-01')).toBe(1);
    expect(daysBetween('2020-01-01', '2021-01-01')).toBe(366); // 2020 leap year
    expect(daysBetween('2021-01-01', '2022-01-01')).toBe(365);
  });

  it('adds days correctly across month and year boundaries', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-02-28', 2)).toBe('2024-03-01');
    expect(addDays('2023-12-31', 1)).toBe('2024-01-01');
    expect(addDays('2024-01-01', -1)).toBe('2023-12-31');
  });

  it('determines ISO weekdays (1=Mon, 7=Sun)', () => {
    // 2026-10-22 is Thursday -> 4
    expect(getWeekday('2026-10-22')).toBe(4);
    // 2026-10-19 is Monday -> 1
    expect(getWeekday('2026-10-19')).toBe(1);
    // 2026-10-25 is Sunday -> 7
    expect(getWeekday('2026-10-25')).toBe(7);
  });

  describe('Duration formatting boundaries', () => {
    it('handles < 60 minutes', () => {
      const res = formatWatchDuration(45);
      expect(res.compact).toBe('45 mins');
      expect(res.detailed).toBe('45 minutes');
    });

    it('handles 59 minutes boundary', () => {
      const res = formatWatchDuration(59);
      expect(res.compact).toBe('59 mins');
      expect(res.detailed).toBe('59 minutes');
    });

    it('handles exactly 24 hours (1440 mins)', () => {
      const res = formatWatchDuration(1440);
      expect(res.compact).toBe('~1 days');
      expect(res.detailed).toBe('1 day');
    });

    it('handles 29 days boundary (29 * 1440 = 41760 mins)', () => {
      const res = formatWatchDuration(29 * 24 * 60);
      expect(res.compact).toBe('~29 days');
      expect(res.detailed).toBe('29 days');
    });

    it('handles 30 days boundary (30 * 1440 = 43200 mins -> 1 month)', () => {
      const res = formatWatchDuration(30 * 24 * 60);
      expect(res.compact).toBe('~30 days');
      expect(res.detailed).toBe('1 month');
    });

    it('handles detailed multi-unit duration with months, days, hours', () => {
      // 82 days and 20 hours -> 2 months (60d) + 22 days + 20 hours
      const mins = (82 * 24 + 20) * 60;
      const res = formatWatchDuration(mins);
      expect(res.compact).toBe('~82 days');
      expect(res.detailed).toBe('2 months, 22 days, 20 hours');
    });
  });
});
