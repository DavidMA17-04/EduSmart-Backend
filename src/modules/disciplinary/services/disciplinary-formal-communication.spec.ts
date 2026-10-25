import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuditLog } from '../../administrative/users/entities/audit-log.entity';
import { InfractionSeverity } from '../constants/infraction-severity.constant';
import { DisciplinaryCaseStatus, DisciplinaryTrack } from '../constants/disciplinary.enums';
import { DisciplinaryCaseEventEntity } from '../entities/disciplinary-case-event.entity';
import { DisciplinaryCaseEntity } from '../entities/disciplinary-case.entity';
import {
  DisciplinaryCommunicationEntity,
  DisciplinaryNotificationEntity,
} from '../entities/disciplinary-communication.entity';
import { InfractionTypeEntity } from '../entities/infraction-type.entity';
import { MANDATORY_CLAUSES } from './disciplinary-clauses';
import { DisciplinaryCommunicationsService } from './disciplinary-communications.service';
import { DisciplinaryInvestigationService } from './disciplinary-investigation.service';
import { DisciplinaryWorkflowService } from './disciplinary-workflow.service';

describe('comunicación formal', () => {
  it('pasa a Comunicada, notifica a cada encargado y abre 3 días hábiles de descargo', async () => {
    const harness = createHarness([
      { id: 70, email: 'encargado@colegio.cr' },
      { id: 71, email: null },
    ]);
    const result = await harness.service.communicate(guide(), 3, {
      proposedAction: 'Amonestación escrita y entrevista con el encargado.',
    });

    expect(result).toMatchObject({
      status: DisciplinaryCaseStatus.COMMUNICATED,
      stepBusinessDays: 3,
    });
    expect(result.communicationId).toBe(harness.saved.find((item) => item.kind === 'FORMAL_CHARGE')?.id);
    expect(harness.row.status).toBe(DisciplinaryCaseStatus.COMMUNICATED);
    expect(harness.row.stepBusinessDays).toBe(3);
    expect(harness.row.notifiedAt).toBeInstanceOf(Date);
    const communication = harness.saved.find((item) => item.kind === 'FORMAL_CHARGE');
    expect(communication?.body).toEqual(expect.stringContaining('Agresión'));
    expect(communication?.body).toEqual(expect.stringContaining('Amonestación escrita'));
    expect(communication?.body).toEqual(expect.stringContaining('aula 2'));
    for (const clause of MANDATORY_CLAUSES) {
      expect(communication?.body).toEqual(expect.stringContaining(clause));
    }
    expect(harness.saved.filter((item) => item.guardianUserId)).toHaveLength(2);
    expect(harness.mail.sendMail).toHaveBeenCalledTimes(1);
    expect(harness.events.some((event) => event.fromStatus === 'INVESTIGATING' && event.toStatus === 'COMMUNICATED')).toBe(
      true,
    );
  });

  it('sin encargado vinculado no envía y exige la entrega física', async () => {
    const harness = createHarness([]);
    await expect(
      harness.service.communicate(guide(), 3, {
        proposedAction: 'Amonestación escrita y entrevista con el encargado.',
      }),
    ).rejects.toMatchObject({ response: { code: 'PHYSICAL_DELIVERY_REQUIRED' } });
    expect(harness.row.status).toBe(DisciplinaryCaseStatus.INVESTIGATING);
    expect(harness.saved).toHaveLength(0);
    expect(harness.mail.sendMail).not.toHaveBeenCalled();
  });

  it('un docente ajeno no comunica y un expediente fuera de investigación tampoco', async () => {
    const harness = createHarness([{ id: 70, email: 'encargado@colegio.cr' }]);
    await expect(
      harness.service.communicate({ id: 8, roles: ['Docente'], permissions: [] } as never, 3, {
        proposedAction: 'Amonestación escrita y entrevista con el encargado.',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    harness.row.status = DisciplinaryCaseStatus.REPORTED;
    await expect(
      harness.service.communicate(guide(), 3, {
        proposedAction: 'Amonestación escrita y entrevista con el encargado.',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(harness.saved).toHaveLength(0);
  });
});

function guide() {
  return { id: 7, roles: ['Docente'], permissions: [] } as never;
}

function createHarness(guardians: Array<{ id: number; email: string | null }>) {
  const row = {
    id: 3,
    track: DisciplinaryTrack.DUE_PROCESS,
    status: DisciplinaryCaseStatus.INVESTIGATING,
    responsibleUserId: 7,
    reporterUserId: 4,
    studentUserId: 10,
    infractionTypeId: 5,
    severity: InfractionSeverity.SERIOUS,
    caseNumber: 'AM-2026-0008',
    occurredAt: new Date('2026-10-13T15:00:00.000Z'),
    place: 'aula 2',
    description: 'Empujó a un compañero durante el recreo.',
  } as DisciplinaryCaseEntity;
  const events: DisciplinaryCaseEventEntity[] = [];
  const saved: Array<Record<string, unknown>> = [];
  let nextId = 1;
  const store = (value: Record<string, unknown>) => {
    const stored = { id: nextId++, ...value };
    saved.push(stored);
    return stored;
  };
  const eventRepo = {
    create: (value: Partial<DisciplinaryCaseEventEntity>) => value,
    save: async (value: Partial<DisciplinaryCaseEventEntity>) => {
      const stored = { id: nextId++, visibility: 'PUBLIC', ...value } as DisciplinaryCaseEventEntity;
      events.push(stored);
      return stored;
    },
  };
  const auditRepo = {
    create: (value: Partial<AuditLog>) => value,
    save: async (value: Partial<AuditLog>) => value,
  };
  const recordRepo = {
    create: (value: Record<string, unknown>) => value,
    save: async (value: Record<string, unknown>) => store(value),
  };
  const manager = {
    query: async () => guardians,
    update: async (entity: unknown, _id: number, patch: Partial<DisciplinaryCaseEntity>) => {
      if (entity === DisciplinaryCaseEntity) Object.assign(row, patch);
    },
    getRepository: (entity: unknown) => {
      if (entity === DisciplinaryCaseEventEntity) return eventRepo;
      if (entity === AuditLog) return auditRepo;
      if (entity === DisciplinaryCommunicationEntity || entity === DisciplinaryNotificationEntity) return recordRepo;
      if (entity === InfractionTypeEntity) return { findOne: async () => ({ id: 5, name: 'Agresión' }) };
      throw new Error('Repositorio no previsto');
    },
  };
  const dataSource = {
    getRepository: () => ({ findOne: async () => row }),
    transaction: async (work: (current: typeof manager) => Promise<unknown>) => work(manager),
  };
  const mail = { sendMail: jest.fn().mockResolvedValue(undefined) };
  const communications = new DisciplinaryCommunicationsService(mail as never, { update: jest.fn() } as never);
  const service = new DisciplinaryInvestigationService(
    dataSource as never,
    new DisciplinaryWorkflowService(),
    communications,
  );
  return { row, events, saved, mail, service };
}
