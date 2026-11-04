/**
 * Detects inclusive date-range overlap between two [start, end] intervals (ISO date strings).
 * Used for anti-traslape de cursos lectivos dentro del mismo año lectivo.
 */
export function datesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  return startA <= endB && startB <= endA;
}
