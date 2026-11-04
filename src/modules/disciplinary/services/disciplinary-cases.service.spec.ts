import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { InfractionSeverity } from '../constants/infraction-severity.constant';
import { DisciplinaryAccessService } from './disciplinary-access.service';
import { DisciplinaryCasesService } from './disciplinary-cases.service';

describe('DisciplinaryCasesService', () => {
  it('no consulta si la búsqueda tiene menos de 2 caracteres', async () => {
    const dataSource = { query: jest.fn() };
    const service = new DisciplinaryCasesService(
      dataSource as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(service.searchStudents('a')).rejects.toBeInstanceOf(BadRequestException);
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('rechaza el registro cuando el estudiante no tiene matrícula activa', async () => {
    const types = {
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        severity: InfractionSeverity.SERIOUS,
        isActive: true,
      }),
    };
    const nonWorkingDays = { find: jest.fn().mockResolvedValue([]) };
    const dataSource = {
      transaction: jest.fn(async (work: (manager: { query: jest.Mock }) => Promise<unknown>) =>
        work({ query: jest.fn().mockResolvedValue([]) }),
      ),
    };
    const service = new DisciplinaryCasesService(
      dataSource as never,
      types as never,
      nonWorkingDays as never,
      { issue: jest.fn(), dispatch: jest.fn() } as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.create({ id: 4 } as never, {
        studentUserId: 10,
        infractionTypeId: 1,
        occurredAt: '2026-10-14T15:00:00.000Z',
        place: 'Aula 1',
        description: 'Descripción de los hechos con más de veinte caracteres.',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza la bandeja si el actor no tiene view ni view_own', async () => {
    const service = serviceWith({ query: jest.fn().mockResolvedValue([]) });
    await expect(service.list({ id: 4, roles: [], permissions: [] } as never, {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('restringe la bandeja del docente a lo que reportó o a su sección guía', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const service = serviceWith({ query });
    await service.list(
      { id: 4, roles: ['Docente'], permissions: [PERMISSIONS.DISCIPLINARY_VIEW_OWN] } as never,
      { status: 'INVESTIGATING' as never },
    );
    const listCall = query.mock.calls.find((call) => String(call[0]).includes('disciplinary_cases c'));
    expect(String(listCall?.[0])).toContain('c.status = ?');
    expect(String(listCall?.[0])).toContain('c.id_users_reporter = ?');
    expect(listCall?.[1]).toEqual(['INVESTIGATING', 4, 4]);
  });

  it('limita la bandeja del encargado a los expedientes de sus representados', async () => {
    const query = jest.fn(async (sql: string, ..._rest: unknown[]) => {
      if (sql.includes('guardian_student_links')) return [{ studentUserId: 10 }, { studentUserId: 11 }];
      return [];
    });
    const service = serviceWith({ query });
    await service.list(
      { id: 70, roles: ['Encargado'], permissions: [PERMISSIONS.DISCIPLINARY_VIEW_OWN] } as never,
      {},
    );
    const listCall = query.mock.calls.find((call) => String(call[0]).includes('disciplinary_cases c'));
    expect(String(listCall?.[0])).toContain('c.id_users_student IN (?, ?)');
    expect(listCall?.[1]).toEqual(expect.arrayContaining([70, 70, 10, 11]));
    expect(listCall?.[1]).not.toContain(99);
  });

  it('oculta la cronología reservada y los testigos al estudiante', async () => {
    const detail = await serviceWith(detailSource()).findOne(studentActor(), 3);
    expect(detail.witnesses).toBeNull();
    expect(detail.events.map((event) => event.type)).toEqual(['CASE_OPENED']);
    expect(detail.dueOn).toBeTruthy();
    expect(detail.student.fullName).toBe('Luis Mora');
    expect(detail.readReceipts).toEqual([]);
    expect(detail.communications).toEqual([]);
    expect(detail.alerts).toEqual([]);
  });

  it('el responsable ve la notificación sin confirmar y el estudiante no', async () => {
    const source = detailSource();
    const query = source.query.getMockImplementation()!;
    source.query.mockImplementation(async (sql: string) => {
      if (sql.includes('read_at IS NULL')) {
        return [{ notificationId: 4, readAt: null, issuedAt: new Date('2026-10-14T15:00:00.000Z') }];
      }
      return query(sql);
    });
    const responsible = { id: 4, roles: ['Docente'], permissions: [PERMISSIONS.DISCIPLINARY_VIEW_OWN] } as never;
    const detail = await serviceWith(source).findOne(responsible, 3);
    expect(detail.alerts).toEqual([
      expect.objectContaining({ message: 'Notificación sin confirmar', notificationId: 4 }),
    ]);
    const hidden = await serviceWith(source).findOne(studentActor(), 3);
    expect(hidden.alerts).toEqual([]);
  });

  it('el encargado ve el expediente de su representado, sin testigos ni criterio, y no el de otro', async () => {
    const source = detailSource();
    const query = source.query.getMockImplementation()!;
    source.query.mockImplementation(async (sql: string) => {
      if (sql.includes('guardian_student_links')) return [{ studentUserId: 10 }];
      if (sql.includes('disciplinary_notifications')) {
        return [
          {
            id: 9,
            readAt: new Date('2026-10-19T15:30:00.000Z'),
            name: 'Ana',
            firstLastname: 'Sol',
            secondLastname: null,
          },
        ];
      }
      return query(sql);
    });
    const guardian = { id: 70, roles: ['Encargado'], permissions: [PERMISSIONS.DISCIPLINARY_VIEW_OWN] } as never;
    const detail = await serviceWith(source).findOne(guardian, 3);
    expect(detail.student.id).toBe(10);
    expect(detail.witnesses).toBeNull();
    expect(detail.events.map((event) => event.type)).toEqual(['CASE_OPENED']);
    expect(detail.readReceipts).toEqual([
      expect.objectContaining({ label: 'Leída por Ana Sol el 19/10/2026' }),
    ]);

    source.caseRow.id_users_student = 99;
    await expect(serviceWith(source).findOne(guardian, 3)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('responde 403 cuando el docente consulta un expediente ajeno', async () => {
    const source = detailSource();
    source.caseRow.id_users_student = 99;
    source.caseRow.id_users_reporter = 8;
    await expect(serviceWith(source).findOne(studentActor(), 3)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

function studentActor() {
  return { id: 10, roles: ['Estudiante'], permissions: [PERMISSIONS.DISCIPLINARY_VIEW_OWN] } as never;
}

function serviceWith(dataSource: { query: jest.Mock }) {
  return new DisciplinaryCasesService(
    dataSource as never,
    {} as never,
    { find: jest.fn().mockResolvedValue([]) } as never,
    {} as never,
    new DisciplinaryAccessService(),
    { reconcileDeadlines: jest.fn().mockResolvedValue(0) } as never,
  );
}

function detailSource() {
  const caseRow: Record<string, unknown> = {
    id_disciplinary_cases: 3,
    case_number: 'AM-2026-0001',
    id_users_student: 10,
    id_users_reporter: 4,
    id_users_responsible: 4,
    id_groups: 8,
    id_academic_periods: 1,
    id_disciplinary_infraction_types: 2,
    id_subjects: null,
    original_severity: 'SERIOUS',
    severity: 'SERIOUS',
    track: 'DUE_PROCESS',
    status: 'INVESTIGATING',
    occurred_at: new Date('2026-10-14T15:00:00.000Z'),
    place: 'Aula',
    description: 'Hechos descritos con suficiente detalle.',
    witnesses: 'Pedro',
    is_late_report: 0,
    late_report_reason: null,
    missing_guide_teacher: 0,
    step_started_on: '2026-10-16',
    step_business_days: 10,
    resolution_outcome: null,
    resolution_reasoning: null,
    notified_at: null,
    firm_at: null,
    studentName: 'Luis',
    studentFirstLastname: 'Mora',
    studentSecondLastname: null,
    studentNationalId: '101110111',
    groupName: 'A',
    sectionName: 'Décimo',
    gradeLevel: 10,
    infractionName: 'Agresión',
  };
  const query = jest.fn(async (sql: string) => {
    if (sql.includes('teaching_assignments') || sql.includes('guardian_student_links')) return [];
    if (sql.includes('WHERE c.id_disciplinary_cases')) return [caseRow];
    if (sql.includes('disciplinary_case_events')) {
      return [
        {
          id: 1,
          type: 'CASE_OPENED',
          actorUserId: 4,
          fromStatus: null,
          toStatus: 'REPORTED',
          payload: null,
          visibility: 'PUBLIC',
          createdAt: new Date('2026-10-16T15:00:00.000Z'),
        },
        {
          id: 2,
          type: 'COUNSEL_OPINION',
          actorUserId: 9,
          fromStatus: null,
          toStatus: null,
          payload: { note: 'reservado' },
          visibility: 'RESERVED',
          createdAt: new Date('2026-10-17T15:00:00.000Z'),
        },
      ];
    }
    if (sql.includes('disciplinary_evidences')) return [];
    if (sql.includes('disciplinary_notifications')) return [];
    if (sql.includes('FROM users')) {
      return [{ id: 4, name: 'Ana', firstLastname: 'Sol', secondLastname: null }];
    }
    return [];
  });
  return { query, caseRow };
}