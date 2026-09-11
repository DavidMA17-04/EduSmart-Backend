/** Business calendar timezone for EduSmart (CTP Hojancha). */
export const BUSINESS_TIME_ZONE = 'America/Costa_Rica';

/**
 * Calendar date YYYY-MM-DD for an instant in America/Costa_Rica.
 * Avoids UTC date rollover (e.g. after 18:00 local in CR).
 */
export function calendarDateInTimeZone(
  instant: Date,
  timeZone: string = BUSINESS_TIME_ZONE,
): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error(`Unable to format calendar date for timezone ${timeZone}`);
  }

  return `${year}-${month}-${day}`;
}

export type BusinessLocalClock = {
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm:ss (24h) */
  time: string;
  /**
   * EduSmart schedule dayOfWeek: Monday=1 … Friday=5.
   * Saturday=6, Sunday=7 (outside Mon–Fri schedule).
   */
  dayOfWeek: number;
};

const WEEKDAY_TO_EDUSMART: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

/**
 * Local calendar date + clock + weekday in America/Costa_Rica (authority).
 */
export function localClockInTimeZone(
  instant: Date,
  timeZone: string = BUSINESS_TIME_ZONE,
): BusinessLocalClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(instant);

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  const hour = parts.find((p) => p.type === 'hour')?.value;
  const minute = parts.find((p) => p.type === 'minute')?.value;
  const second = parts.find((p) => p.type === 'second')?.value;
  const weekday = parts.find((p) => p.type === 'weekday')?.value;

  if (!year || !month || !day || !hour || !minute || !second || !weekday) {
    throw new Error(`Unable to format local clock for timezone ${timeZone}`);
  }

  const dayOfWeek = WEEKDAY_TO_EDUSMART[weekday];
  if (dayOfWeek == null) {
    throw new Error(`Unable to map weekday "${weekday}" for timezone ${timeZone}`);
  }

  return {
    date: `${year}-${month}-${day}`,
    time: `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second.padStart(2, '0')}`,
    dayOfWeek,
  };
}

function normalizeHms(value: string): string {
  const raw = String(value ?? '');
  const full = raw.match(/(\d{2}:\d{2}:\d{2})/);
  if (full) return full[1];
  const short = raw.match(/(\d{2}:\d{2})/);
  if (short) return `${short[1]}:00`;
  return raw;
}

/** Subtract minutes from HH:mm:ss; clamps at 00:00:00. */
export function subtractMinutesFromTime(time: string, minutes: number): string {
  const [h, m, s] = normalizeHms(time).split(':').map(Number);
  let total = h * 60 + m - minutes;
  if (total < 0) total = 0;
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * PO window: [startTime - 10m, endTime] inclusive on local HH:mm:ss strings.
 */
export function isWithinScheduleStartWindow(
  startTime: string,
  endTime: string,
  localTimeHms: string,
  leadMinutes = 10,
): boolean {
  const now = normalizeHms(localTimeHms);
  const from = subtractMinutesFromTime(startTime, leadMinutes);
  const until = normalizeHms(endTime);
  return now >= from && now <= until;
}
