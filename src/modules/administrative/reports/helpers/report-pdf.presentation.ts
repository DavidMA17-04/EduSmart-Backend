const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const COSTA_RICA_TIME_ZONE = 'America/Costa_Rica';

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  CLOSED: 'Cerrado',
  BLOCKED: 'Bloqueado',
  PENDING: 'Pendiente',
  PLANNED: 'Planificado',
};

export const EMPTY_VALUE = '—';

export function formatStatus(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function formatDateOnly(value: string): string {
  const match = DATE_ONLY.exec(value);
  if (!match) {
    return value;
  }

  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

export function formatDateTimeCostaRica(value: Date): string {
  const parts = new Intl.DateTimeFormat('es-CR', {
    timeZone: COSTA_RICA_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(value);

  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';

  const day = read('day').padStart(2, '0');
  const month = read('month').padStart(2, '0');
  const year = read('year');
  const hour = read('hour');
  const minute = read('minute').padStart(2, '0');
  const dayPeriod = normalizeDayPeriod(read('dayPeriod'));

  return `${day}/${month}/${year} ${hour}:${minute} ${dayPeriod}`;
}

export function joinFilterLabels(labels: string[]): string {
  if (labels.length === 0) {
    return 'Ninguno';
  }

  return labels.join(' · ');
}

export function displayValue(value: string | null | undefined): string {
  if (value === null || value === undefined || value.trim() === '') {
    return EMPTY_VALUE;
  }

  return value;
}

function normalizeDayPeriod(value: string): string {
  const normalized = value
    .normalize('NFKC')
    .replace(/[\u00A0\u202F\u2007\u2009]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (
    normalized.startsWith('p') ||
    normalized.includes('p.m') ||
    normalized.includes('pm')
  ) {
    return 'p. m.';
  }

  return 'a. m.';
}
