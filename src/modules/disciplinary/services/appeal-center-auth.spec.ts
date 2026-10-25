import { ForbiddenException } from '@nestjs/common';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { AppealKind, AppealOutcome, DisciplinaryCaseStatus, DisciplinaryTrack } from '../constants/disciplinary.enums';
import { InfractionSeverity } from '../constants/infraction-severity.constant';
import { DisciplinaryAppealEntity } from '../entities/disciplinary-appeal.entity';
import { DisciplinaryCaseEventEntity } from '../entities/disciplinary-case-event.entity';
import { DisciplinaryCaseEntity } from '../entities/disciplinary-case.entity';
import { AuditLog } from '../../administrative/users/entities/audit-log.entity';
import { institutionalToday, isBusinessDay } from '../utils/business-days';
import { DisciplinaryAppealQueryService } from './disciplinary-appeal-query.service';
import { DisciplinaryAppealsService } from './disciplinary-appeals.service';
import { DisciplinaryExportService } from './disciplinary-export.service';
import { DisciplinaryWorkflowService } from './disciplinary-workflow.service';

jest.mock('../utils/business-days', () => {
  const actual = jest.requireActual('../utils/business-days') as typeof import('../utils/business-days');
  return { ...actual, institutionalToday: () => '2026-10-17' };
});

describe('autorización cruzada del Centro', () => {
  it('el encargado no ve un expediente ajeno, el docente ajeno no resuelve y el encargado no exporta', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('guardian_student_links')) return [{ studentUserId: 10 }];
      if (sql.includes('teaching_assignments')) return [];
      if (sql.includes('FROM disciplinary_appeals a')) return [];
      return [];
    });
    const listed = await new DisciplinaryAppealQueryService(
      { query } as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      { reconcileDeadlines: jest.fn().mockResolvedValue(0) } as never,
    ).list(guardian(), { studentUserId: 99 });
    expect(listed.data).toEqual([]);
    const listSql = String(query.mock.calls.find((call) => String(call[0]).includes('FROM disciplinary_appeals a'))?.[0]);
    expect(listSql).toContain('c.id_users_student IN (?)');

    await expect(
      new DisciplinaryAppealQueryService(
        { query: jest.fn().mockResolvedValue([]) } as never,
        { find: jest.fn().mockResolvedValue([]) } as never,
        { reconcileDeadlines: jest.fn().mockResolvedValue(0) } as never,
      ).dashboard(guardian(), { studentUserId: 99 }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const harness = createHarness();
    const filed = await harness.service.fileRevocation(guardian(), 3, {
      body: 'Se interpone el recurso porque la medida no valora el descargo presentado.',
    });
    await expect(
      harness.service.resolveRevocation(stranger(), 3, filed.id, {
        outcome: AppealOutcome.UPHOLD,
        reasoning: 'Se valora el escrito y la prueba del expediente para resolver el recurso.',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(harness.appeals[0].outcome).toBeNull();

    await expect(
      new DisciplinaryExportService({} as never, {
        listAll: jest.fn().mockRejectedValue(new ForbiddenException('No tiene acceso')),
      } as never).exportAppealsExcel(guardian() as never, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

function guardian() {
  return {
    id: 70,
    roles: ['Encargado'],
    permissions: [PERMISSIONS.DISCIPLINARY_VIEW_OWN, PERMISSIONS.DISCIPLINARY_RESPOND],
  } as never;
}

function stranger() {
  return { id: 8, roles: ['Docente'], permissions: [PERMISSIONS.DISCIPLINARY_RESOLVE] } as never;
}

function createHarness() {
  const row = {
    id: 3,
    track: DisciplinaryTrack.DUE_PROCESS,
    status: DisciplinaryCaseStatus.RESOLVED,
    studentUserId: 10,
    responsibleUserId: 7,
    severity: InfractionSeverity.SERIOUS,
    caseNumber: 'AM-2026-0098',
    stepStartedOn: subtractBusinessDays(institutionalToday(), 1),
    stepBusinessDays: 3,
    notifiedAt: new Date('2026-10-15T18:00:00.000Z'),
  } as DisciplinaryCaseEntity;
  const appeals: DisciplinaryAppealEntity[] = [];
  let nextId = 1;
  const appealRepo = {
    count: async () => appeals.length,
    find: async () => appeals,
    findOne: async (query: { where: { id: number } }) => appeals.find((item) => item.id === query.where.id) ?? null,
    create: (value: Partial<DisciplinaryAppealEntity>) => value,
    save: async (value: Partial<DisciplinaryAppealEntity>) => {
      const stored = { id: nextId++, outcome: null, isSubsidiary: false, ...value } as DisciplinaryAppealEntity;
      appeals.push(stored);
      return stored;
    },
    update: async (id: number, patch: Partial<DisciplinaryAppealEntity>) => {
      const found = appeals.find((item) => item.id === id);
      if (found) Object.assign(found, patch);
    },
  };
  const manager = {
    query: async () => [],
    update: async () => undefined,
    getRepository: (entity: unknown) => {
      if (entity === DisciplinaryAppealEntity) return appealRepo;
      if (entity === DisciplinaryCaseEventEntity) {
        return { create: (value: unknown) => value, save: async (value: unknown) => value };
      }
      if (entity === AuditLog) return { create: (value: unknown) => value, save: async (value: unknown) => value };
      throw new Error('Repositorio no previsto');
    },
  };
  const service = new DisciplinaryAppealsService(
    {
      query: async () => [{ studentUserId: 10 }],
      getRepository: () => ({ findOne: async () => row }),
      transaction: async (work: (current: typeof manager) => Promise<unknown>) => work(manager),
    } as never,
    new DisciplinaryWorkflowService(),
    { issue: jest.fn().mockResolvedValue({ communicationId: 4, pending: [], notified: false }), dispatch: jest.fn() } as never,
  );
  return { appeals, service };
}

function subtractBusinessDays(startIso: string, days: number): string {
  const [year, month, day] = startIso.split('-').map(Number);
  const cursor = new Date(Date.UTC(year, month - 1, day));
  let remaining = days;
  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (isBusinessDay(cursor.toISOString().slice(0, 10))) remaining -= 1;
  }
  return cursor.toISOString().slice(0, 10);
}
