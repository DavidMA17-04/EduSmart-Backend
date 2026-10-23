/**
 * When true, from-schedule skips weekday + start-window gates (local QA / demos).
 * Explicit ATTENDANCE_RELAX_SCHEDULE_GATES=true|false overrides NODE_ENV.
 * Default: relaxed only when NODE_ENV=development (not in test/production).
 */
export function isAttendanceScheduleGatesRelaxed(): boolean {
  const raw = process.env.ATTENDANCE_RELAX_SCHEDULE_GATES?.trim().toLowerCase();
  if (raw === 'true' || raw === '1' || raw === 'yes') return true;
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  return process.env.NODE_ENV === 'development';
}
