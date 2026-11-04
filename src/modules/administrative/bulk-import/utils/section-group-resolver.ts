import { calendarDateInTimeZone } from '../../../../common/utils/business-calendar-date.util';

export type ActiveGroupCandidate = {
  groupId: number;
  groupName: string;
  academicPeriodId: number;
  academicPeriodName: string;
  periodStartDate: string;
};

export type SectionResolution =
  | { kind: 'EMPTY' }
  | { kind: 'RESOLVED'; group: ActiveGroupCandidate }
  | { kind: 'NOT_FOUND' }
  | { kind: 'AMBIGUOUS'; matches: number };

export type SectionResolver = (section: string | null | undefined) => SectionResolution;

export function normalizeSectionName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/** Índice por nombre normalizado de los grupos activos en cursos lectivos activos. */
export function buildSectionResolver(groups: ActiveGroupCandidate[]): SectionResolver {
  const index = new Map<string, ActiveGroupCandidate[]>();
  for (const group of groups) {
    const key = normalizeSectionName(group.groupName);
    index.set(key, [...(index.get(key) ?? []), group]);
  }
  return (section) => {
    const key = section ? normalizeSectionName(section) : '';
    if (!key) return { kind: 'EMPTY' };
    const matches = index.get(key) ?? [];
    if (matches.length === 0) return { kind: 'NOT_FOUND' };
    if (matches.length > 1) return { kind: 'AMBIGUOUS', matches: matches.length };
    return { kind: 'RESOLVED', group: matches[0] };
  };
}

/** Fecha de inicio de matrícula: la mayor entre hoy y el inicio del curso lectivo. */
export function enrollmentStartDate(periodStartDate: string, today: Date = new Date()): string {
  const todayIso = calendarDateInTimeZone(today);
  const start = String(periodStartDate).slice(0, 10);
  return start > todayIso ? start : todayIso;
}
