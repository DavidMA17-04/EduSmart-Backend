import { ForbiddenException } from '@nestjs/common';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { InfractionSeverity } from '../constants/infraction-severity.constant';
import { AppealKind, AppealOutcome, CommunicationKind, DisciplinaryCaseStatus, DisciplinaryTrack } from '../constants/disciplinary.enums';
import { DisciplinaryAppealEntity } from '../entities/disciplinary-appeal.entity';
import { DisciplinaryCaseEventEntity } from '../entities/disciplinary-case-event.entity';
import { DisciplinaryCaseEntity } from '../entities/disciplinary-case.entity';
import { AuditLog } from '../../administrative/users/entities/audit-log.entity';
import { institutionalToday, isBusinessDay } from '../utils/business-days';
import { DisciplinaryAppealsService } from './disciplinary-appeals.service';
import { DisciplinaryNotificationsService } from './disciplinary-notifications.service';
import { DisciplinaryWorkflowService } from './disciplinary-workflow.service';
import { deductionOf } from './conduct-grade';

const TODAY = institutionalToday();
const TEXT = 'Se interpone el recurso porque la medida no valora el descargo presentado.';
const REASONING = 'Se valora el escrito y la prueba del expediente para resolver el recurso.';

describe('integración del Centro de apelaciones', () => {
  it('camino feliz sin subsidio: interponer, resolver, comunicar, leer y no descontar nota', async () => {
    const harness = createAppealHarness({ linked: true });
    const filed = await harness.appeals.fileRevocation(guardian(), 3, { body: TEXT });
    expect(harness.appealsRows).toEqual([expect.objectContaining({ kind: AppealKind.REVOCATION, outcome: null })]);

    await expect(
      harness.appeals.resolveRevocation(stranger(), 3, filed.id, { outcome: AppealOutcome.UPHOLD, reasoning: REASONING }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(harness.appealsRows[0].outcome).toBeNull();

    await harness.appeals.resolveRevocation(guide(), 3, filed.id, {
      outcome: AppealOutcome.UPHOLD,
      reasoning: REASONING,
    });
    expect(harness.issue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ kind: CommunicationKind.APPEAL_RESOLUTION }),
    );
    expect(harness.appealsRows[0].outcome).toBe(AppealOutcome.UPHOLD);

    const inbox = new DisciplinaryNotificationsService({ query: harness.notifyQuery } as never);
    expect((await inbox.mine(guardian())).unreadCount).toBe(1);
    const first = await inbox.confirmRead(guardian(), 5, { ipAddress: '10.0.0.8', userAgent: 'Centro' });
    const second = await inbox.confirmRead(guardian(), 5, { ipAddress: '10.9.9.9', userAgent: 'otro' });
    expect(second.readAt).toBe(first.readAt);
    expect(second.readIp).toBe('10.0.0.8');
    expect(harness.notifyUpdateCount()).toBeGreaterThanOrEqual(1);
    expect(deductionOf(DisciplinaryCaseStatus.IN_APPEAL, InfractionSeverity.SERIOUS).state).toBe('PROPOSED');
  });

  it('camino con subsidio: eleva apelación y Dirección resuelve por el POST de Sprint 4', async () => {
    const harness = createAppealHarness({ linked: true });
    const filed = await harness.appeals.fileRevocation(guardian(), 3, { body: TEXT, subsidiary: true });
    await harness.appeals.resolveRevocation(guide(), 3, filed.id, {
      outcome: AppealOutcome.UPHOLD,
      reasoning: REASONING,
    });
    const appeal = harness.appealsRows.find((item) => item.kind === AppealKind.APPEAL);
    expect(appeal?.isSubsidiary).toBe(true);
    expect(harness.events.some((event) => event.type === 'SUBSIDIARY_ELEVATED')).toBe(true);
    const result = await harness.appeals.resolveAppeal(director(), 3, appeal!.id, {
      outcome: AppealOutcome.MODIFY,
      severity: InfractionSeverity.MINOR,
      reasoning: REASONING,
    });
    expect(result).toMatchObject({ status: DisciplinaryCaseStatus.FIRM, deduction: 10 });
    expect(harness.issue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ kind: CommunicationKind.APPEAL_RESOLUTION }),
    );
  });
});

function guardian() {
  return { id: 70, roles: ['Encargado'], permissions: [PERMISSIONS.DISCIPLINARY_RESPOND, PERMISSIONS.DISCIPLINARY_VIEW_OWN] } as never;
}

function guide() {
  return { id: 7, roles: ['Docente'], permissions: [PERMISSIONS.DISCIPLINARY_RESOLVE] } as never;
}

function director() {
  return { id: 2, roles: ['Director'], permissions: [PERMISSIONS.DISCIPLINARY_APPEAL] } as never;
}

function stranger() {
  return { id: 8, roles: ['Docente'], permissions: [PERMISSIONS.DISCIPLINARY_RESOLVE] } as never;
}

function createAppealHarness(input: { linked: boolean }) {
  const row = {
    id: 3,
    track: DisciplinaryTrack.DUE_PROCESS,
    status: DisciplinaryCaseStatus.RESOLVED,
    studentUserId: 10,
    responsibleUserId: 7,
    severity: InfractionSeverity.SERIOUS,
    caseNumber: 'AM-2026-0099',
    stepStartedOn: subtractBusinessDays(TODAY, 1),
    stepBusinessDays: 3,
    notifiedAt: new Date('2026-10-15T18:00:00.000Z'),
  } as DisciplinaryCaseEntity;
  const appealsRows: DisciplinaryAppealEntity[] = [];
  const events: Array<{ type: string }> = [];
  let nextId = 1;
  const appealRepo = {
    count: async (query: { where: { caseId: number; kind?: AppealKind } }) =>
      appealsRows.filter((item) => item.caseId === query.where.caseId && (!query.where.kind || item.kind === query.where.kind)).length,
    find: async (query: { where: { caseId: number } }) => appealsRows.filter((item) => item.caseId === query.where.caseId),
    findOne: async (query: { where: { id: number; caseId: number; kind: AppealKind } }) =>
      appealsRows.find(
        (item) => item.id === query.where.id && item.caseId === query.where.caseId && item.kind === query.where.kind,
      ) ?? null,
    create: (value: Partial<DisciplinaryAppealEntity>) => value,
    save: async (value: Partial<DisciplinaryAppealEntity>) => {
      const stored = { id: nextId++, outcome: null, isSubsidiary: false, ...value } as DisciplinaryAppealEntity;
      appealsRows.push(stored);
      return stored;
    },
    update: async (id: number, patch: Partial<DisciplinaryAppealEntity>) => {
      const found = appealsRows.find((item) => item.id === id);
      if (found) Object.assign(found, patch);
    },
  };
  const manager = {
    query: async () => [],
    update: async (entity: unknown, _id: number, patch: Partial<DisciplinaryCaseEntity>) => {
      if (entity === DisciplinaryCaseEntity) Object.assign(row, patch);
    },
    getRepository: (entity: unknown) => {
      if (entity === DisciplinaryAppealEntity) return appealRepo;
      if (entity === DisciplinaryCaseEventEntity) {
        return {
          create: (value: { type: string }) => value,
          save: async (value: { type: string }) => {
            events.push(value);
            return value;
          },
        };
      }
      if (entity === AuditLog) return { create: (value: unknown) => value, save: async (value: unknown) => value };
      throw new Error('Repositorio no previsto');
    },
  };
  const issue = jest.fn().mockResolvedValue({ communicationId: 4, pending: [], notified: false });
  const appeals = new DisciplinaryAppealsService(
    {
      query: async () => (input.linked ? [{ studentUserId: 10 }] : []),
      getRepository: () => ({ findOne: async () => row }),
      transaction: async (work: (current: typeof manager) => Promise<unknown>) => work(manager),
    } as never,
    new DisciplinaryWorkflowService(),
    { issue, dispatch: jest.fn() } as never,
  );
  const receipt = {
    readAt: null as Date | null,
    readIp: null as string | null,
    readUserAgent: null as string | null,
  };
  let notifyUpdates = 0;
  const notifyQuery = jest.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.includes('UPDATE')) {
      notifyUpdates += 1;
      if (!receipt.readAt) {
        receipt.readAt = params[0] as Date;
        receipt.readIp = params[1] as string;
        receipt.readUserAgent = params[2] as string;
      }
      return { affectedRows: 1 };
    }
    if (sql.includes('id_disciplinary_notifications = ?')) {
      return [
        {
          id: 5,
          communicationId: 4,
          caseId: 3,
          caseNumber: row.caseNumber,
          kind: CommunicationKind.APPEAL_RESOLUTION,
          studentUserId: 10,
          studentName: 'Estudiante',
          studentFirstLastname: 'DiscQA',
          studentSecondLastname: null,
          issuedAt: new Date(),
          readAt: receipt.readAt,
          readIp: receipt.readIp,
          readUserAgent: receipt.readUserAgent,
          guardianName: 'Ana',
          guardianFirstLastname: 'Sol',
          guardianSecondLastname: null,
        },
      ];
    }
    return [
      {
        id: 5,
        communicationId: 4,
        caseId: 3,
        caseNumber: row.caseNumber,
        kind: CommunicationKind.APPEAL_RESOLUTION,
        studentUserId: 10,
        studentName: 'Estudiante',
        studentFirstLastname: 'DiscQA',
        studentSecondLastname: null,
        issuedAt: new Date(),
        readAt: receipt.readAt,
      },
    ];
  });
  return { row, appealsRows, events, issue, appeals, notifyQuery, notifyUpdateCount: () => notifyUpdates };
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
