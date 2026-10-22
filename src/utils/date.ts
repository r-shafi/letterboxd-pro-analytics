/**
 * Strict calendar date helpers (no timezone conversion, no Date/toISOString skew).
 * All inputs and outputs represent YYYY-MM-DD civil calendar dates.
 */

export interface CalendarDateParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

const DAYS_IN_MONTH = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function getDaysInMonth(year: number, month: number): number {
  if (month === 2 && isLeapYear(year)) {
    return 29;
  }
  return DAYS_IN_MONTH[month] || 30;
}

/**
 * Parses YYYY-MM-DD string into numeric parts without using native Date.
 */
export function parseCalendarDate(str: string): CalendarDateParts | null {
  if (!str || typeof str !== 'string') return null;
  const trimmed = str.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12) return null;
  const maxDays = getDaysInMonth(year, month);
  if (day < 1 || day > maxDays) return null;

  return { year, month, day };
}

/**
 * Validates and formats numeric parts to YYYY-MM-DD.
 */
export function formatCalendarDate(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns Rata Die (day count from year 1-01-01) for calendar date calculation.
 */
export function calendarDateToRataDie(year: number, month: number, day: number): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m - 3) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/**
 * Converts Rata Die back to CalendarDateParts.
 */
export function rataDieToCalendarDate(rd: number): CalendarDateParts {
  const z = rd + 719468;
  const era = Math.floor((z >= 0 ? z : z - 146096) / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return {
    year: m <= 2 ? y + 1 : y,
    month: m,
    day: d
  };
}

/**
 * Calculates absolute number of days between two calendar dates (d2 - d1).
 */
export function daysBetween(d1: string, d2: string): number {
  const p1 = parseCalendarDate(d1);
  const p2 = parseCalendarDate(d2);
  if (!p1 || !p2) return 0;
  return calendarDateToRataDie(p2.year, p2.month, p2.day) - calendarDateToRataDie(p1.year, p1.month, p1.day);
}

/**
 * Adds N days to a YYYY-MM-DD date.
 */
export function addDays(dateStr: string, days: number): string {
  const p = parseCalendarDate(dateStr);
  if (!p) return dateStr;
  const rd = calendarDateToRataDie(p.year, p.month, p.day) + days;
  const res = rataDieToCalendarDate(rd);
  return formatCalendarDate(res.year, res.month, res.day);
}

/**
 * Returns ISO weekday: 1 for Monday, ..., 7 for Sunday.
 * Sakamoto's algorithm or Rata Die mod 7.
 */
export function getWeekday(dateStr: string): number {
  const p = parseCalendarDate(dateStr);
  if (!p) return 1;
  const rd = calendarDateToRataDie(p.year, p.month, p.day);
  // rd = 0 corresponds to 1970-01-01 (Thursday = 4)
  const wd = ((rd + 3) % 7 + 7) % 7 + 1;
  return wd; // 1 = Monday, ..., 7 = Sunday
}

/**
 * Returns today's date formatted as YYYY-MM-DD in local system time.
 */
export function getTodayCalendarDate(): string {
  const now = new Date();
  return formatCalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/**
 * Formats duration in minutes into human-readable strings.
 * Rules:
 * 1 month = 30 days.
 * Compact: "~82 days", "~14 hours", "45 mins"
 * Detailed: "2 months, 21 days, 20 hours"
 */
export function formatWatchDuration(minutes: number, locale = 'en-US'): { compact: string; detailed: string } {
  if (minutes <= 0 || isNaN(minutes)) {
    return { compact: '0 mins', detailed: '0 minutes' };
  }

  const pluralRules = new Intl.PluralRules(locale);
  const unit = (val: number, singular: string, plural: string) => {
    return pluralRules.select(val) === 'one' ? `${val} ${singular}` : `${val} ${plural}`;
  };

  const totalHours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (totalHours < 1) {
    const compact = `${minutes} mins`;
    const detailed = unit(minutes, 'minute', 'minutes');
    return { compact, detailed };
  }

  const totalDays = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (totalDays < 1) {
    const compact = `~${totalHours} hrs`;
    const detailed = remainingMinutes > 0
      ? `${unit(totalHours, 'hour', 'hours')}, ${unit(remainingMinutes, 'minute', 'minutes')}`
      : unit(totalHours, 'hour', 'hours');
    return { compact, detailed };
  }

  const months = Math.floor(totalDays / 30);
  const days = totalDays % 30;

  const compact = `~${totalDays} days`;

  const parts: string[] = [];
  if (months > 0) parts.push(unit(months, 'month', 'months'));
  if (days > 0) parts.push(unit(days, 'day', 'days'));
  if (hours > 0) parts.push(unit(hours, 'hour', 'hours'));
  if (parts.length === 0 && remainingMinutes > 0) {
    parts.push(unit(remainingMinutes, 'minute', 'minutes'));
  }

  const detailed = parts.join(', ');
  return { compact, detailed };
}
