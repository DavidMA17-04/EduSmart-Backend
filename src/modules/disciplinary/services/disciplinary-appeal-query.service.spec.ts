import { ForbiddenException } from '@nestjs/common';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { AppealKind, DisciplinaryCaseStatus, DisciplinaryTrack } from '../constants/disciplinary.enums';
import { DisciplinaryAppealQueryService } from './disciplinary-appeal-query.service';

jest.mock('../utils/business-days', () => {
  const actual = jest.requireActual('../utils/business-days') as typeof import('../utils/business-days');
  return { ...actual, institutionalToday: () => '2026-10-17' };
});

const APPEAL_A = listedAppeal({
  id: 1,
  caseId: 11,
  caseNumber: 'AM-2026-0001',
  studentUserId: 10,
  kind: AppealKind.REVOCATION,
});
const APPEAL_B = listedAppeal({
  id: 2,
  caseId: 22,
  caseNumber: 'AM-2026-0002',
  studentUserId: 20,
  kind: AppealKind.REVOCATION,
});

describe('DisciplinaryAppealQueryService', () => {
  it('el encargado solo ve recursos de sus representados y pagina el resultado', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('guardian_student_links')) return [{ studentUserId: 10 }];
      if (sql.includes('teaching_assignments')) return [];
      if (sql.includes('FROM disciplinary_appeals a')) return [APPEAL_A];
      return [];
    });
    const result = await serviceWith(query).list(guardian(), { page: 1, pageSize: 20 });
    expect(result).toMatchObject({ total: 1, page: 1, pageSize: 20 });
    expect(result.data.map((item) => item.caseNumber)).toEqual(['AM-2026-0001']);
    const listSql = String(query.mock.calls.find((call) => String(call[0]).includes('FROM disciplinary_appeals a'))?.[0]);
    expect(listSql).toContain('c.id_users_student IN (?)');
  });

  it('un docente sin guía ni reporte no ve expedientes ajenos', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('guardian_student_links') || sql.includes('teaching_assignments')) return [];
      if (sql.includes('FROM disciplinary_appeals a')) return [];
      return [];
    });
    const result = await serviceWith(query).list(teacher(), {});
    expect(result.data).toEqual([]);
    const listCall = sqlCall(query, 'FROM disciplinary_appeals a');
    expect(listCall[0]).toContain('c.id_users_reporter = ?');
    expect(listCall[1]).toEqual(expect.arrayContaining([8, 8]));
  });

  it('Dirección lista con filtros, total y tamaño de página', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('guardian_student_links') || sql.includes('teaching_assignments')) return [];
      if (sql.includes('FROM disciplinary_appeals a')) return [APPEAL_A, APPEAL_B];
      return [];
    });
    const result = await serviceWith(query).list(director(), {
      kind: AppealKind.REVOCATION,
      page: 1,
      pageSize: 1,
    });
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(1);
    expect(result.data).toHaveLength(1);
    const listCall = sqlCall(query, 'FROM disciplinary_appeals a');
    expect(listCall[1]).toEqual([AppealKind.REVOCATION]);
  });

  it('niega el listado si el actor no tiene view ni view_own', async () => {
    await expect(
      serviceWith(jest.fn().mockResolvedValue([])).list({ id: 9, roles: ['Docente'], permissions: [] } as never, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('un expediente en plazo aparece como elegible y el vencido o ajeno no', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('guardian_student_links')) return [{ studentUserId: 10 }];
      if (sql.includes('teaching_assignments')) return [];
      if (sql.includes('FROM disciplinary_cases c')) {
        return [
          eligibleRow({ caseId: 11, caseNumber: 'AM-2026-0011', studentUserId: 10, stepStartedOn: '2026-10-15' }),
          eligibleRow({ caseId: 12, caseNumber: 'AM-2026-0012', studentUserId: 10, stepStartedOn: '2026-10-13' }),
          eligibleRow({ caseId: 22, caseNumber: 'AM-2026-0022', studentUserId: 20, stepStartedOn: '2026-10-15' }),
        ];
      }
      if (sql.includes('FROM disciplinary_appeals')) return [];
      return [];
    });
    const result = await serviceWith(query).listEligible(guardian());
    expect(result.total).toBe(1);
    expect(result.data).toEqual([
      expect.objectContaining({
        caseNumber: 'AM-2026-0011',
        kind: AppealKind.REVOCATION,
      }),
    ]);
  });

  it('el guía ve su revocatoria pendiente y no las apelaciones de Dirección', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('guardian_student_links') || sql.includes('teaching_assignments')) return [];
      if (sql.includes('FROM disciplinary_appeals a')) {
        return [
          { ...listedAppeal({ id: 1, caseId: 11, caseNumber: 'AM-2026-0001', studentUserId: 10, kind: AppealKind.REVOCATION }), body: 'Fundamento propio', caseSeverity: 'MINOR', responsibleUserId: 7 },
          { ...listedAppeal({ id: 3, caseId: 33, caseNumber: 'AM-2026-0003', studentUserId: 10, kind: AppealKind.APPEAL }), body: 'Apelación', caseSeverity: 'MINOR', responsibleUserId: 7 },
        ];
      }
      return [];
    });
    const result = await serviceWith(query).listReviewable(guide(), {});
    expect(result.data.map((item) => item.caseNumber)).toEqual(['AM-2026-0001']);
    const listCall = sqlCall(query, 'FROM disciplinary_appeals a');
    expect(listCall[0]).toContain("a.kind = 'REVOCATION'");
    expect(listCall[0]).toContain('c.id_users_responsible = ?');
    expect(listCall[0]).not.toContain("a.kind = 'APPEAL'");
    expect(listCall[1]).toEqual([7]);
  });

  it('Dirección ve la apelación elevada y no la revocatoria ajena', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('guardian_student_links') || sql.includes('teaching_assignments')) return [];
      if (sql.includes('FROM disciplinary_appeals a')) {
        return [
          { ...listedAppeal({ id: 3, caseId: 33, caseNumber: 'AM-2026-0003', studentUserId: 10, kind: AppealKind.APPEAL }), body: 'Apelación elevada', caseSeverity: 'SERIOUS' },
        ];
      }
      return [];
    });
    const result = await serviceWith(query).listReviewable(
      { id: 2, roles: ['Director'], permissions: [PERMISSIONS.DISCIPLINARY_APPEAL, PERMISSIONS.DISCIPLINARY_READ] } as never,
      {},
    );
    expect(result.data).toEqual([expect.objectContaining({ caseNumber: 'AM-2026-0003', kind: AppealKind.APPEAL, body: 'Apelación elevada' })]);
    const listCall = sqlCall(query, 'FROM disciplinary_appeals a');
    expect(listCall[0]).toContain("a.kind = 'APPEAL'");
    expect(listCall[0]).not.toContain('id_users_responsible = ?');
  });

  it('un docente ajeno no ve ni abre recursos de otro expediente', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('guardian_student_links') || sql.includes('teaching_assignments')) return [];
      if (sql.includes('FROM disciplinary_appeals a') && sql.includes('id_disciplinary_appeals = ?')) {
        return [{ ...listedAppeal({ id: 1, caseId: 11, caseNumber: 'AM-2026-0001', studentUserId: 10, kind: AppealKind.REVOCATION }), body: 'Ajeno', responsibleUserId: 7 }];
      }
      if (sql.includes('FROM disciplinary_appeals a')) return [];
      return [];
    });
    const foreign = { id: 8, roles: ['Docente'], permissions: [PERMISSIONS.DISCIPLINARY_RESOLVE, PERMISSIONS.DISCIPLINARY_VIEW_OWN] } as never;
    const listed = await serviceWith(query).listReviewable(foreign, {});
    expect(listed.data).toEqual([]);
    await expect(serviceWith(query).getReviewable(foreign, 1)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('el detalle de revisión expone el fundamento y el AM-', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('guardian_student_links') || sql.includes('teaching_assignments')) return [];
      if (sql.includes('id_disciplinary_appeals = ?')) {
        return [{ ...listedAppeal({ id: 1, caseId: 11, caseNumber: 'AM-2026-0001', studentUserId: 10, kind: AppealKind.REVOCATION }), body: 'El estudiante no participó.', caseSeverity: 'MINOR', responsibleUserId: 7 }];
      }
      return [];
    });
    const item = await serviceWith(query).getReviewable(guide(), 1);
    expect(item).toMatchObject({ caseNumber: 'AM-2026-0001', body: 'El estudiante no participó.' });
  });

  it('un actor no legitimado no ve expedientes elegibles aunque estén en plazo', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('guardian_student_links') || sql.includes('teaching_assignments')) return [];
      if (sql.includes('FROM disciplinary_cases c')) {
        return [eligibleRow({ caseId: 11, caseNumber: 'AM-2026-0011', studentUserId: 10, stepStartedOn: '2026-10-15' })];
      }
      return [];
    });
    const result = await serviceWith(query).listEligible(teacher());
    expect(result.data).toEqual([]);
  });

  it('el seguimiento muestra cronología real, rebajo propuesto y no marca lectura', async () => {
    const query = jest.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes('guardian_student_links')) return [{ studentUserId: 10 }];
      if (sql.includes('teaching_assignments')) return [];
      if (sql.includes('id_disciplinary_appeals = ?')) {
        expect(params).toEqual([1]);
        return [
          {
            ...listedAppeal({ id: 1, caseId: 11, caseNumber: 'AM-2026-0001', studentUserId: 10, kind: AppealKind.REVOCATION }),
            body: 'Se interpone porque el descargo no se valoró.',
            reasoning: null,
            witnesses: 'Testigo reservado',
            reporterUserId: 7,
          },
        ];
      }
      if (sql.includes('FROM disciplinary_case_events')) {
        return [{ type: 'REVOCATION_FILED', createdAt: '2026-10-16T15:00:00.000Z', payload: { note: 'Recurso de revocatoria presentado' }, visibility: 'PUBLIC' }];
      }
      if (sql.includes('FROM disciplinary_appeals')) {
        return [{ kind: AppealKind.REVOCATION, isSubsidiary: 0, filedAt: '2026-10-16T15:00:00.000Z', resolvedAt: null, outcome: null }];
      }
      if (sql.includes('FROM disciplinary_notifications')) {
        return [{ id: 9, communicationId: 4, guardianUserId: 70, readAt: null, kind: 'APPEAL_RESOLUTION', issuedAt: '2026-10-17T12:00:00.000Z' }];
      }
      if (sql.includes('FROM disciplinary_communications')) {
        return [{ id: 4, kind: 'APPEAL_RESOLUTION', issuedAt: '2026-10-17T12:00:00.000Z' }];
      }
      return [];
    });
    const item = await serviceWith(query).getTracking(guardian(), 1);
    expect(item.caseNumber).toBe('AM-2026-0001');
    expect(item.witnesses).toBeNull();
    expect(item.deductionState).toBe('PROPOSED');
    expect(item.deductionLabel).toContain('propuesto');
    expect(item.timeline.map((entry) => entry.kind)).toEqual(['REVOCATION_FILED', 'NOTIFIED']);
    expect(item.timeline.map((entry) => entry.title).join(' ')).not.toMatch(/comit[eé]/i);
    expect(item.resolutionNotice).toMatchObject({ notificationId: 9, readAt: null, canConfirm: true });
    expect(query.mock.calls.every((call) => !String(call[0]).includes('UPDATE'))).toBe(true);
  });

  it('Dirección ve testigos y el encargado ajeno no abre el seguimiento', async () => {
    const trackingRow = {
      ...listedAppeal({ id: 1, caseId: 11, caseNumber: 'AM-2026-0001', studentUserId: 10, kind: AppealKind.REVOCATION }),
      body: 'Fundamento',
      reasoning: 'Se mantiene la medida.',
      witnesses: 'Ana testigo',
      reporterUserId: 7,
    };
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('guardian_student_links') || sql.includes('teaching_assignments')) return [];
      if (sql.includes('id_disciplinary_appeals = ?')) return [trackingRow];
      if (sql.includes('FROM disciplinary_case_events') || sql.includes('FROM disciplinary_appeals') || sql.includes('FROM disciplinary_communications') || sql.includes('FROM disciplinary_notifications')) {
        return [];
      }
      return [];
    });
    const directorView = await serviceWith(query).getTracking(director(), 1);
    expect(directorView.witnesses).toBe('Ana testigo');
    expect(directorView).not.toHaveProperty('reservedCriteria');

    const foreign = jest.fn(async (sql: string) => {
      if (sql.includes('guardian_student_links')) return [{ studentUserId: 99 }];
      if (sql.includes('teaching_assignments')) return [];
      if (sql.includes('id_disciplinary_appeals = ?')) return [trackingRow];
      return [];
    });
    await expect(serviceWith(foreign).getTracking(guardian(), 1)).rejects.toBeInstanceOf(ForbiddenException);
    expect(foreign.mock.calls.every((call) => !String(call[0]).includes('UPDATE'))).toBe(true);
  });

  it('sin notificación de encargado no inventa lectura al abrir el Centro', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('guardian_student_links') || sql.includes('teaching_assignments')) return [];
      if (sql.includes('id_disciplinary_appeals = ?')) {
        return [
          {
            ...listedAppeal({ id: 1, caseId: 11, caseNumber: 'AM-2026-0001', studentUserId: 10, kind: AppealKind.REVOCATION }),
            body: 'Fundamento',
            reasoning: null,
            witnesses: null,
            reporterUserId: 7,
          },
        ];
      }
      if (sql.includes('FROM disciplinary_communications')) {
        return [{ id: 4, kind: 'APPEAL_RESOLUTION', issuedAt: '2026-10-17T12:00:00.000Z' }];
      }
      return [];
    });
    const item = await serviceWith(query).getTracking(director(), 1);
    expect(item.resolutionNotice).toMatchObject({
      communicationId: 4,
      notificationId: null,
      readAt: null,
      canConfirm: false,
    });
    expect(query.mock.calls.every((call) => !String(call[0]).includes('UPDATE'))).toBe(true);
  });

  it('el tablero de recursos exige disciplinary.view y cuenta pendientes y resueltos', async () => {
    await expect(serviceWith(jest.fn().mockResolvedValue([])).dashboard(guardian(), {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    const query = jest.fn(async (sql: string) => {
      if (sql.includes('guardian_student_links') || sql.includes('teaching_assignments')) return [];
      if (sql.includes('FROM disciplinary_appeals a')) {
        return [
          listedAppeal({ id: 1, caseId: 11, caseNumber: 'AM-2026-0001', studentUserId: 10, kind: AppealKind.REVOCATION }),
          {
            ...listedAppeal({ id: 2, caseId: 22, caseNumber: 'AM-2026-0002', studentUserId: 20, kind: AppealKind.APPEAL }),
            outcome: 'UPHOLD',
            resolvedAt: '2026-10-20T12:00:00.000Z',
            caseStatus: DisciplinaryCaseStatus.FIRM,
          },
        ];
      }
      return [];
    });
    const board = await serviceWith(query).dashboard(director(), { kind: AppealKind.REVOCATION });
    expect(board.total).toBe(2);
    expect(board.pending).toBe(1);
    expect(board.resolved).toBe(1);
    expect(board.byKind.REVOCATION).toBe(1);
    expect(JSON.stringify(board)).not.toMatch(/beca|nota académica/i);
    const listCall = sqlCall(query, 'FROM disciplinary_appeals a');
    expect(listCall[1]).toEqual([AppealKind.REVOCATION]);
  });
});

function sqlCall(query: jest.Mock, fragment: string): [string, Array<string | number>] {
  const found = query.mock.calls.find((call) => String(call[0]).includes(fragment));
  if (!found) throw new Error(`No se ejecutó la consulta ${fragment}`);
  return found as [string, Array<string | number>];
}

function serviceWith(query: jest.Mock) {
  return new DisciplinaryAppealQueryService(
    { query } as never,
    { find: jest.fn().mockResolvedValue([]) } as never,
    { reconcileDeadlines: jest.fn().mockResolvedValue(0) } as never,
  );
}

function guardian() {
  return {
    id: 70,
    roles: ['Encargado'],
    permissions: [PERMISSIONS.DISCIPLINARY_VIEW_OWN, PERMISSIONS.DISCIPLINARY_RESPOND],
  } as never;
}

function teacher() {
  return { id: 8, roles: ['Docente'], permissions: [PERMISSIONS.DISCIPLINARY_VIEW_OWN] } as never;
}

function director() {
  return { id: 2, roles: ['Director'], permissions: [PERMISSIONS.DISCIPLINARY_READ] } as never;
}

function guide() {
  return {
    id: 7,
    roles: ['Docente'],
    permissions: [PERMISSIONS.DISCIPLINARY_RESOLVE, PERMISSIONS.DISCIPLINARY_VIEW_OWN],
  } as never;
}

function listedAppeal(input: {
  id: number;
  caseId: number;
  caseNumber: string;
  studentUserId: number;
  kind: AppealKind;
}) {
  return {
    id: input.id,
    caseId: input.caseId,
    kind: input.kind,
    isSubsidiary: 0,
    outcome: null,
    filedAt: '2026-10-16T15:00:00.000Z',
    filedByUserId: 70,
    resolvedAt: null,
    resolverUserId: null,
    caseNumber: input.caseNumber,
    caseStatus: DisciplinaryCaseStatus.IN_APPEAL,
    caseSeverity: 'MINOR',
    track: DisciplinaryTrack.DUE_PROCESS,
    studentUserId: input.studentUserId,
    name: 'Ana',
    firstLastname: 'Mora',
    secondLastname: 'Solis',
    groupId: 5,
    groupName: 'A',
    gradeLevel: 10,
    responsibleUserId: 7,
    stepStartedOn: '2026-10-15',
    stepBusinessDays: 3,
  };
}

function eligibleRow(input: {
  caseId: number;
  caseNumber: string;
  studentUserId: number;
  stepStartedOn: string;
}) {
  return {
    caseId: input.caseId,
    caseNumber: input.caseNumber,
    caseStatus: DisciplinaryCaseStatus.RESOLVED,
    track: DisciplinaryTrack.DUE_PROCESS,
    studentUserId: input.studentUserId,
    name: 'Ana',
    firstLastname: 'Mora',
    secondLastname: 'Solis',
    responsibleUserId: 7,
    stepStartedOn: input.stepStartedOn,
    stepBusinessDays: 3,
  };
}
