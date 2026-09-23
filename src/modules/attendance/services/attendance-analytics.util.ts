/** Institutional early-warning threshold: absence rate at or above this is critical. */
export const CRITICAL_ABSENCE_RATE = 20;

/** Consecutive ABSENT marks that trigger a disciplinary/formative alert. */
export const CRITICAL_CONSECUTIVE_ABSENCES = 3;

export const COSTA_RICA_TIME_ZONE = 'America/Costa_Rica';

export function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function roundRate(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

/** Presentismo: presentes + tardías sobre el total de marcas. */
export function presentismoRate(
  present: number,
  late: number,
  total: number,
): number {
  if (total <= 0) return 0;
  return roundRate(((present + late) / total) * 100);
}

export function costaRicaTodayIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: COSTA_RICA_TIME_ZONE,
  }).format(now);
}

export const STATUS_COUNT_SQL = {
  present: "SUM(CASE WHEN a.status = 'PRESENT' THEN 1 ELSE 0 END)",
  absent: "SUM(CASE WHEN a.status = 'ABSENT' THEN 1 ELSE 0 END)",
  late: "SUM(CASE WHEN a.status = 'LATE' THEN 1 ELSE 0 END)",
  justified: "SUM(CASE WHEN a.status = 'JUSTIFIED' THEN 1 ELSE 0 END)",
  presentismo:
    "ROUND((SUM(CASE WHEN a.status IN ('PRESENT', 'LATE') THEN 1 ELSE 0 END) / NULLIF(COUNT(a.id_attendance), 0)) * 100, 2)",
} as const;
