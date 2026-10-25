import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuditLog } from '../../administrative/users/entities/audit-log.entity';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { InfractionSeverity } from '../constants/infraction-severity.constant';
import { AppealKind, AppealOutcome, CommunicationKind, DisciplinaryCaseStatus, DisciplinaryTrack } from '../constants/disciplinary.enums';
import { DisciplinaryAppealEntity } from '../entities/disciplinary-appeal.entity';
import { DisciplinaryCaseEventEntity } from '../entities/disciplinary-case-event.entity';
import { DisciplinaryCaseEntity } from '../entities/disciplinary-case.entity';
import { institutionalToday, isBusinessDay } from '../utils/business-days';
import { DisciplinaryAppealsService } from './disciplinary-appeals.service';
import { DisciplinaryWorkflowService } from './disciplinary-workflow.service';

const TODAY = institutionalToday();
const ON_TIME_START = subtractBusinessDays(TODAY, 1);
const LATE_START = subtractBusinessDays(TODAY, 4);

const TEXT = 'Se interpone el recurso porque la medida no valora el descargo presentado.';
const REASONING = 'Se valora el escrito y la prueba del expediente para resolver el recurso.';

describe('recursos de revocatoria y apelación', () => {
  it('el encargado interpone la revocatoria el segundo día hábil y el expediente queda en recurso', async () => {
    const harness = createHarness({ linked: true, stepStartedOn: ON_TIME_START });
    const result = await harness.service.fileRevocation(guardian(), 3, { body: TEXT });
    expect(result).toMatchObject({
      status: DisciplinaryCaseStatus.IN_APPEAL,
      kind: 'REVOCATION',
      stepBusinessDays: 3,
      isSubsidiary: false,
    });
    expect(harness.row.status).toBe(DisciplinaryCaseStatus.IN_APPEAL);
  });

  it('rechaza la revocatoria extemporánea y a quien no puede interponerla', async () => {
    const late = createHarness({ linked: true, stepStartedOn: LATE_START });
    await expect(late.service.fileRevocation(guardian(), 3, { body: TEXT })).rejects.toMatchObject({
      response: { code: 'APPEAL_DEADLINE' },
    });
    expect(late.row.status).toBe(DisciplinaryCaseStatus.RESOLVED);

    const foreign = createHarness({ linked: false, stepStartedOn: ON_TIME_START });
    await expect(foreign.service.fileRevocation(guardian(), 3, { body: TEXT })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('quien dictó el acto acoge la revocatoria y el expediente queda desestimado', async () => {
    const harness = createHarness({ linked: true, stepStartedOn: ON_TIME_START });
    const filed = await harness.service.fileRevocation(guardian(), 3, { body: TEXT });
    await expect(
      harness.service.resolveRevocation(stranger(), 3, filed.id, {
        outcome: AppealOutcome.REVOKE,
        reasoning: REASONING,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const result = await harness.service.resolveRevocation(guide(), 3, filed.id, {
      outcome: AppealOutcome.REVOKE,
      reasoning: REASONING,
    });
    expect(result).toMatchObject({ status: DisciplinaryCaseStatus.DISMISSED, deduction: 0 });
    expect(harness.row.status).toBe(DisciplinaryCaseStatus.DISMISSED);
    expect(harness.issue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ kind: CommunicationKind.APPEAL_RESOLUTION }),
    );
  });

  it('al rechazar la revocatoria con apelación en subsidio la eleva a Dirección por 8 días', async () => {
    const harness = createHarness({ linked: true, stepStartedOn: ON_TIME_START });
    const filed = await harness.service.fileRevocation(guardian(), 3, { body: TEXT, subsidiary: true });
    const result = await harness.service.resolveRevocation(guide(), 3, filed.id, {
      outcome: AppealOutcome.UPHOLD,
      reasoning: REASONING,
    });
    expect(result).toMatchObject({ status: DisciplinaryCaseStatus.IN_APPEAL, stepBusinessDays: 8 });
    expect(harness.appeals.some((item) => item.kind === AppealKind.APPEAL && item.isSubsidiary && !item.outcome)).toBe(
      true,
    );
    expect(harness.events.some((event) => event.type === 'SUBSIDIARY_ELEVATED')).toBe(true);
    expect(harness.row.status).toBe(DisciplinaryCaseStatus.IN_APPEAL);
  });

  it('Dirección acoge parcialmente, baja el rebajo a 10 y deja el expediente firme', async () => {
    const harness = createHarness({ linked: true, stepStartedOn: ON_TIME_START });
    const filed = await harness.service.fileRevocation(guardian(), 3, { body: TEXT, subsidiary: true });
    await harness.service.resolveRevocation(guide(), 3, filed.id, {
      outcome: AppealOutcome.UPHOLD,
      reasoning: REASONING,
    });
    const appeal = harness.appeals.find((item) => item.kind === AppealKind.APPEAL);
    await expect(
      harness.service.resolveAppeal(guide(), 3, appeal!.id, {
        outcome: AppealOutcome.MODIFY,
        severity: InfractionSeverity.MINOR,
        reasoning: REASONING,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const result = await harness.service.resolveAppeal(director(), 3, appeal!.id, {
      outcome: AppealOutcome.MODIFY,
      severity: InfractionSeverity.MINOR,
      reasoning: REASONING,
    });
    expect(result).toMatchObject({
      status: DisciplinaryCaseStatus.FIRM,
      severity: InfractionSeverity.MINOR,
      deduction: 10,
    });
    expect(harness.row.firmAt).toBeInstanceOf(Date);
    expect(harness.row.severity).toBe(InfractionSeverity.MINOR);
  });

  it('rechaza Acoge parcialmente en revocatoria y deja el recurso pendiente', async () => {
    const harness = createHarness({ linked: true, stepStartedOn: ON_TIME_START });
    const filed = await harness.service.fileRevocation(guardian(), 3, { body: TEXT });
    await expect(
      harness.service.resolveRevocation(guide(), 3, filed.id, {
        outcome: AppealOutcome.MODIFY,
        reasoning: REASONING,
      }),
    ).rejects.toMatchObject({ response: { code: 'APPEAL_OUTCOME' } });
    expect(harness.appeals.find((item) => item.id === filed.id)?.outcome ?? null).toBeNull();
  });

  it('si la revocatoria se rechaza sin subsidio, la apelación posterior cabe y la extemporánea no', async () => {
    const harness = createHarness({ linked: true, stepStartedOn: ON_TIME_START });
    const filed = await harness.service.fileRevocation(guide(), 3, { body: TEXT });
    await harness.service.resolveRevocation(guide(), 3, filed.id, {
      outcome: AppealOutcome.UPHOLD,
      reasoning: REASONING,
    });
    const appeal = await harness.service.fileAppeal(guardian(), 3, { body: TEXT });
    expect(appeal.stepBusinessDays).toBe(8);

    harness.row.stepStartedOn = LATE_START;
    harness.row.stepBusinessDays = 3;
    const late = createHarness({ linked: true, stepStartedOn: LATE_START, status: DisciplinaryCaseStatus.IN_APPEAL });
    late.appeals.push({
      id: 1,
      caseId: 3,
      kind: AppealKind.REVOCATION,
      isSubsidiary: false,
      outcome: AppealOutcome.UPHOLD,
    } as DisciplinaryAppealEntity);
    await expect(late.service.fileAppeal(guardian(), 3, { body: TEXT })).rejects.toBeInstanceOf(BadRequestException);
  });
});

function guardian() {
  return { id: 70, roles: ['Encargado'], permissions: [PERMISSIONS.DISCIPLINARY_RESPOND] } as never;
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

function createHarness(input: { linked: boolean; stepStartedOn: string; status?: DisciplinaryCaseStatus }) {
  const row = {
    id: 3,
    track: DisciplinaryTrack.DUE_PROCESS,
    status: input.status ?? DisciplinaryCaseStatus.RESOLVED,
    studentUserId: 10,
    responsibleUserId: 7,
    severity: InfractionSeverity.SERIOUS,
    caseNumber: 'AM-2026-0008',
    stepStartedOn: input.stepStartedOn,
    stepBusinessDays: 3,
    notifiedAt: new Date('2026-10-15T18:00:00.000Z'),
  } as DisciplinaryCaseEntity;
  const appeals: DisciplinaryAppealEntity[] = [];
  const events: Array<{ type: string }> = [];
  let nextId = 1;
  const appealRepo = {
    count: async (query: { where: { caseId: number; kind?: AppealKind } }) =>
      appeals.filter((item) => item.caseId === query.where.caseId && (!query.where.kind || item.kind === query.where.kind))
        .length,
    find: async (query: { where: { caseId: number } }) => appeals.filter((item) => item.caseId === query.where.caseId),
    findOne: async (query: { where: { id: number; caseId: number; kind: AppealKind } }) =>
      appeals.find(
        (item) => item.id === query.where.id && item.caseId === query.where.caseId && item.kind === query.where.kind,
      ) ?? null,
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
  const dataSource = {
    query: async () => (input.linked ? [{ studentUserId: 10 }] : []),
    getRepository: () => ({ findOne: async () => row }),
    transaction: async (work: (current: typeof manager) => Promise<unknown>) => work(manager),
  };
  const issue = jest.fn().mockResolvedValue({ communicationId: 4, pending: [], notified: false });
  const service = new DisciplinaryAppealsService(
    dataSource as never,
    new DisciplinaryWorkflowService(),
    { issue, dispatch: jest.fn() } as never,
  );
  return { row, appeals, events, issue, service };
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
