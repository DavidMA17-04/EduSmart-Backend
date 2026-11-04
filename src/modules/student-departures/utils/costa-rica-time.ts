/**
 * Costa Rica no usa horario de verano: UTC-06:00 todo el año.
 * La conexión TypeORM usa `timezone: 'Z'`, así que los DATETIME se guardan en UTC
 * y los límites del "día" institucional deben convertirse a UTC antes de consultar.
 */
export const COSTA_RICA_OFFSET_MINUTES = -6 * 60;
const OFFSET_MS = COSTA_RICA_OFFSET_MINUTES * 60_000;

/** Fecha calendario en Costa Rica (YYYY-MM-DD) para un instante dado. */
export function costaRicaDateString(instant: Date = new Date()): string {
  return new Date(instant.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** Inicio (inclusive) y fin (exclusivo) en UTC de un día calendario de Costa Rica. */
export function costaRicaDayBounds(dateString: string): { start: Date; end: Date } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    throw new Error(`Fecha inválida: ${dateString}`);
  }
  const start = new Date(`${dateString}T00:00:00.000Z`);
  start.setTime(start.getTime() - OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60_000);
  return { start, end };
}

/** Límites UTC de "hoy" en Costa Rica. */
export function costaRicaTodayBounds(now: Date = new Date()): {
  start: Date;
  end: Date;
  date: string;
} {
  const date = costaRicaDateString(now);
  return { ...costaRicaDayBounds(date), date };
}

/** Rango [start, end) en UTC que cubre desde `from` hasta `to` (ambos inclusive, CR). */
export function costaRicaRangeBounds(from?: string, to?: string): { start?: Date; end?: Date } {
  return {
    start: from ? costaRicaDayBounds(from).start : undefined,
    end: to ? costaRicaDayBounds(to).end : undefined,
  };
}
