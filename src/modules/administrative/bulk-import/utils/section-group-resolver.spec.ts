import { buildSectionResolver, enrollmentStartDate } from './section-group-resolver';

describe('section-group-resolver', () => {
  const candidate = (groupId: number, groupName: string) => ({
    groupId,
    groupName,
    academicPeriodId: 7,
    academicPeriodName: 'Curso lectivo 2026',
    periodStartDate: '2026-02-01',
  });

  it('resuelve sin distinguir mayúsculas, tildes ni espacios', () => {
    const resolve = buildSectionResolver([candidate(1, 'Décimo  A')]);
    expect(resolve('  decimo a ')).toMatchObject({ kind: 'RESOLVED', group: { groupId: 1 } });
  });

  it('distingue vacío, no encontrado y ambiguo', () => {
    const resolve = buildSectionResolver([candidate(1, '11-1'), candidate(2, '11-1')]);
    expect(resolve('')).toEqual({ kind: 'EMPTY' });
    expect(resolve(null)).toEqual({ kind: 'EMPTY' });
    expect(resolve('9-9')).toEqual({ kind: 'NOT_FOUND' });
    expect(resolve('11-1')).toEqual({ kind: 'AMBIGUOUS', matches: 2 });
  });

  it('la matrícula inicia en la fecha mayor entre hoy y el inicio del curso', () => {
    const today = new Date('2026-10-07T15:00:00Z');
    expect(enrollmentStartDate('2026-02-01', today)).toBe('2026-10-07');
    expect(enrollmentStartDate('2027-02-01', today)).toBe('2027-02-01');
  });
});
