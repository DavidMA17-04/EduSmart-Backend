import { calendarDateInTimeZone } from '../../../common/utils/business-calendar-date.util';

function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isBusinessDay(iso: string, nonWorkingDays: ReadonlySet<string> = new Set()): boolean {
  const weekday = parseIsoDate(iso).getUTCDay();
  return weekday !== 0 && weekday !== 6 && !nonWorkingDays.has(iso);
}

/**
 * Cuenta `days` días hábiles a partir del día siguiente a `startIso`.
 * `nonWorkingDays` son fechas `YYYY-MM-DD` de `non_working_days`.
 */
export function addBusinessDays(
  startIso: string,
  days: number,
  nonWorkingDays: ReadonlySet<string> = new Set(),
): string {
  const cursor = parseIsoDate(startIso);
  let remaining = days;
  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (isBusinessDay(toIsoDate(cursor), nonWorkingDays)) remaining -= 1;
  }
  return toIsoDate(cursor);
}

/** Días hábiles estrictamente posteriores a `startIso` y hasta `endIso`, inclusive. */
export function businessDaysBetween(
  startIso: string,
  endIso: string,
  nonWorkingDays: ReadonlySet<string> = new Set(),
): number {
  if (endIso <= startIso) return 0;
  const cursor = parseIsoDate(startIso);
  let count = 0;
  let current = startIso;
  while (current < endIso) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    current = toIsoDate(cursor);
    if (isBusinessDay(current, nonWorkingDays)) count += 1;
  }
  return count;
}

export function addNaturalDays(startIso: string, days: number): string {
  const cursor = parseIsoDate(startIso);
  cursor.setUTCDate(cursor.getUTCDate() + days);
  return toIsoDate(cursor);
}

/** Fecha institucional (America/Costa_Rica) de un instante. */
export function institutionalToday(instant: Date = new Date()): string {
  return calendarDateInTimeZone(instant);
}
