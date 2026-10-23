import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { DisciplinaryAccessService } from './disciplinary-access.service';
import { DisciplinaryCasesService } from './disciplinary-cases.service';

describe('historial disciplinario', () => {
  it('Orientación ve los expedientes y la nota del período', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('teaching_assignments') || sql.includes('guardian_student_links')) return [];
      if (sql.includes('FROM users')) return [studentRow()];
      if (sql.includes('group_enrollments')) return [{ groupId: 8 }];
      if (sql.includes('disciplinary_cases')) {
        return [
          caseRow({ id: 1, status: 'FIRM', severity: 'MINOR', infractionName: 'Tardía' }),
          caseRow({ id: 2, status: 'FIRM', severity: 'SERIOUS', infractionName: 'Agresión' }),
          caseRow({ id: 3, status: 'ANNULLED', severity: 'VERY_SERIOUS', infractionName: 'Anulada' }),
          caseRow({ id: 4, status: 'RESOLVED', severity: 'SERIOUS', infractionName: 'En plazo' }),
        ];
      }
      return [];
    });
    const history = await serviceWith(query).history(viewer('disciplinary.view'), 10, {});
    expect(history.student.fullName).toBe('Luis Mora');
    expect(history.periods).toHaveLength(1);
    expect(history.periods[0].conductGrade).toBe(70);
    expect(history.periods[0].cases.map((item) => item.deductionState)).toEqual([
      'APPLIED',
      'APPLIED',
      'NONE',
      'PROPOSED',
    ]);
  });

  it('filtra por estado sin quitar del cálculo los firmes que no se listan', async () => {
    const query = jest.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes('disciplinary_cases')) {
        expect(params).toEqual([10, 4]);
        return [
          caseRow({ id: 1, status: 'FIRM', severity: 'MINOR' }),
          caseRow({ id: 2, status: 'DISMISSED', severity: 'SERIOUS' }),
        ];
      }
      if (sql.includes('FROM users')) return [studentRow()];
      if (sql.includes('group_enrollments')) return [];
      return [];
    });
    const history = await serviceWith(query).history(viewer('disciplinary.view'), 10, {
      academicPeriodId: 4,
      status: 'FIRM' as never,
    });
    expect(history.periods[0].cases).toHaveLength(1);
    expect(history.periods[0].conductGrade).toBe(90);
  });

  it('el encargado solo consulta a sus representados', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('guardian_student_links')) return [{ studentUserId: 11 }];
      if (sql.includes('teaching_assignments')) return [];
      if (sql.includes('FROM users')) return [studentRow()];
      if (sql.includes('group_enrollments')) return [{ groupId: 8 }];
      return [];
    });
    await expect(
      serviceWith(query).history(
        { id: 70, roles: ['Encargado'], permissions: [PERMISSIONS.DISCIPLINARY_VIEW_OWN] } as never,
        10,
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(query.mock.calls.some((call) => String(call[0]).includes('disciplinary_cases'))).toBe(false);
  });

  it('responde 404 si el estudiante no existe y 403 si el actor no consulta expedientes', async () => {
    const missing = jest.fn(async (sql: string) => {
      if (sql.includes('teaching_assignments') || sql.includes('guardian_student_links') || sql.includes('FROM users')) {
        return [];
      }
      return [];
    });
    await expect(serviceWith(missing).history(viewer('disciplinary.view'), 99, {})).rejects.toBeInstanceOf(
      NotFoundException,
    );

    const denied = jest.fn();
    await expect(
      serviceWith(denied).history({ id: 4, roles: ['Docente'], permissions: [] } as never, 10, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(denied).not.toHaveBeenCalled();
  });
});

function viewer(permission: string) {
  return { id: 9, roles: ['Orientador'], permissions: [permission] } as never;
}

function serviceWith(query: jest.Mock) {
  return new DisciplinaryCasesService(
    { query } as never,
    {} as never,
    { find: jest.fn().mockResolvedValue([]) } as never,
    {} as never,
    new DisciplinaryAccessService(),
    { reconcileDeadlines: jest.fn().mockResolvedValue(0) } as never,
  );
}

function studentRow() {
  return { id: 10, name: 'Luis', firstLastname: 'Mora', secondLastname: null, nationalId: '101110111' };
}

function caseRow(partial: { id: number; status: string; severity: string; infractionName?: string }) {
  return {
    id: partial.id,
    caseNumber: `AM-2026-000${partial.id}`,
    status: partial.status,
    severity: partial.severity,
    track: 'DUE_PROCESS',
    academicPeriodId: 4,
    periodName: '2026',
    occurredAt: new Date('2026-03-02T18:00:00.000Z'),
    infractionName: partial.infractionName ?? 'Falta',
  };
}
