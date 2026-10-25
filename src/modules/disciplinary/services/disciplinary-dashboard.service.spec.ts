import { ForbiddenException } from '@nestjs/common';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { DisciplinaryDashboardService } from './disciplinary-dashboard.service';

describe('consulta del tablero', () => {
  it('Dirección filtra por período y ve la institución', async () => {
    const query = jest.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes('teaching_assignments') || sql.includes('non_working_days')) return [];
      expect(sql).toContain('c.id_academic_periods = ?');
      expect(sql).not.toContain('c.id_groups IN');
      expect(params).toEqual([4]);
      return [row(1, 8), row(2, 9)];
    });
    const board = await service(query).get(director(), { academicPeriodId: 4 }, '2026-10-19');
    expect(board.total).toBe(2);
    expect(board.bySection).toHaveLength(2);
  });

  it('el docente guía solo consulta sus secciones', async () => {
    const query = jest.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes('teaching_assignments')) return [{ groupId: 8 }];
      if (sql.includes('non_working_days')) return [];
      expect(sql).toContain('c.id_groups IN (?)');
      expect(params).toEqual([8]);
      return [row(1, 8)];
    });
    const board = await service(query).get(guide(), {}, '2026-10-19');
    expect(board.total).toBe(1);
    expect(board.bySection[0].sectionLabel).toBe('10-A');

    const foreign = jest.fn(async (sql: string) => {
      if (sql.includes('teaching_assignments')) return [{ groupId: 8 }];
      throw new Error('no debe consultar expedientes de otra sección');
    });
    const hidden = await service(foreign).get(guide(), { groupId: 9 }, '2026-10-19');
    expect(hidden.total).toBe(0);
  });

  it('un estudiante no abre el tablero', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('teaching_assignments')) return [];
      throw new Error('no debe leer expedientes');
    });
    await expect(
      service(query).get(
        { id: 10, roles: ['Estudiante'], permissions: [PERMISSIONS.DISCIPLINARY_VIEW_OWN] } as never,
        {},
        '2026-10-19',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('Dirección filtra por nivel y no muestra alertas de otra sección', async () => {
    const query = jest.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes('teaching_assignments') || sql.includes('non_working_days')) return [];
      expect(sql).toContain('s.grade_level = ?');
      expect(params).toEqual([10]);
      return [row(1, 8)];
    });
    const board = await service(query, [
      { code: 'YEAR_WITHOUT_HOLIDAYS', message: 'El año en curso no tiene días no hábiles' },
      { code: 'RECIDIVISM', message: 'Reincidencia', caseId: 50, studentUserId: 99, groupId: 3 },
    ]).get(director(), { gradeLevel: 10 }, '2026-10-19');
    expect(board.total).toBe(1);
    expect(board.alerts.map((item) => item.code)).toEqual(['YEAR_WITHOUT_HOLIDAYS']);
  });

  it('el guía no arrastra alertas de otra sección ni el aviso institucional', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('teaching_assignments')) return [{ groupId: 8 }];
      if (sql.includes('non_working_days')) return [];
      return [row(1, 8)];
    });
    const board = await service(query, [
      { code: 'RECIDIVISM', message: 'Reincidencia', caseId: 1, studentUserId: 10, groupId: 8 },
      { code: 'RECIDIVISM', message: 'Reincidencia', caseId: 50, studentUserId: 99, groupId: 3 },
      { code: 'YEAR_WITHOUT_HOLIDAYS', message: 'El año en curso no tiene días no hábiles' },
    ]).get(guide(), {}, '2026-10-19');
    expect(board.alerts).toEqual([
      { code: 'RECIDIVISM', message: 'Reincidencia', caseId: 1, studentUserId: 10, groupId: 8 },
    ]);
  });
});

function service(query: jest.Mock, alerts: unknown[] = []) {
  return new DisciplinaryDashboardService(
    { query } as never,
    { list: jest.fn().mockResolvedValue({ items: alerts }) } as never,
    { reconcileDeadlines: jest.fn().mockResolvedValue(0) } as never,
  );
}

function director() {
  return { id: 2, roles: ['Director'], permissions: [PERMISSIONS.DISCIPLINARY_READ] } as never;
}

function guide() {
  return { id: 7, roles: ['Docente'], permissions: [PERMISSIONS.DISCIPLINARY_VIEW_OWN] } as never;
}

function row(id: number, groupId: number) {
  return {
    id,
    status: 'REPORTED',
    severity: 'SERIOUS',
    studentUserId: 10,
    name: 'Luis',
    firstLastname: 'Mora',
    secondLastname: null,
    groupId,
    groupName: groupId === 8 ? 'A' : 'B',
    gradeLevel: 10,
    occurredAt: new Date('2026-03-02T18:00:00.000Z'),
    stepStartedOn: '2026-10-19',
    stepBusinessDays: 10,
  };
}
