import { BadRequestException, ConflictException, ForbiddenException, StreamableFile } from '@nestjs/common';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { AuditLog } from '../../administrative/users/entities/audit-log.entity';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { InfractionSeverity } from '../constants/infraction-severity.constant';
import {
  CommunicationKind,
  DeliveryMedium,
  DisciplinaryCaseStatus,
  DisciplinaryTrack,
} from '../constants/disciplinary.enums';
import { DisciplinaryCaseEventEntity } from '../entities/disciplinary-case-event.entity';
import { DisciplinaryCaseEntity } from '../entities/disciplinary-case.entity';
import {
  DisciplinaryCommunicationEntity,
  DisciplinaryNotificationEntity,
} from '../entities/disciplinary-communication.entity';
import { DisciplinaryEvidenceEntity } from '../entities/disciplinary-evidence.entity';
import { InfractionTypeEntity } from '../entities/infraction-type.entity';
import { MANDATORY_CLAUSES } from './disciplinary-clauses';
import { DisciplinaryAccessService } from './disciplinary-access.service';
import { DisciplinaryCommunicationsService } from './disciplinary-communications.service';
import { DisciplinaryDeliveryService } from './disciplinary-delivery.service';
import { DisciplinaryWorkflowService } from './disciplinary-workflow.service';

describe('entrega física y PDF de comunicaciones', () => {
  it('registra el cuaderno y cuenta el plazo desde esa fecha si no hubo envío digital', async () => {
    const harness = createHarness({ guardians: [], notifiedAt: null, status: DisciplinaryCaseStatus.NOTIFIED });
    const result = await harness.service.recordDelivery(guide(), 3, 4, {
      medium: DeliveryMedium.NOTEBOOK,
      deliveredOn: '2026-10-16',
      receivedByName: 'María Solano',
    });
    expect(result).toMatchObject({ medium: 'NOTEBOOK', deliveredOn: '2026-10-16', evidenceId: null });
    expect(harness.communication.deliveryMedium).toBe(DeliveryMedium.NOTEBOOK);
    expect(harness.communication.receivedByName).toBe('María Solano');
    expect(harness.row.status).toBe(DisciplinaryCaseStatus.NOTIFIED);
    expect(harness.row.stepStartedOn).toBe('2026-10-16');
    expect(harness.row.notifiedAt).toEqual(new Date('2026-10-16T18:00:00.000Z'));
    expect(harness.events.some((event) => event.type === 'PHYSICAL_DELIVERY')).toBe(true);
  });

  it('no corre el plazo si la comunicación ya se notificó por la aplicación', async () => {
    const harness = createHarness({
      guardians: [],
      notifiedAt: new Date('2026-10-14T18:00:00.000Z'),
      status: DisciplinaryCaseStatus.COMMUNICATED,
      stepStartedOn: '2026-10-14',
    });
    await harness.service.recordDelivery(guide(), 3, 4, {
      medium: DeliveryMedium.IN_PERSON,
      deliveredOn: '2026-10-16',
      receivedByName: 'María Solano',
    });
    expect(harness.row.stepStartedOn).toBe('2026-10-14');
    expect(harness.row.notifiedAt).toEqual(new Date('2026-10-14T18:00:00.000Z'));
  });

  it('rechaza una segunda entrega, una fecha futura y a un docente ajeno', async () => {
    const harness = createHarness({ guardians: [], notifiedAt: null, status: DisciplinaryCaseStatus.NOTIFIED });
    const dto = { medium: DeliveryMedium.NOTEBOOK, deliveredOn: '2026-10-16', receivedByName: 'María Solano' };
    await harness.service.recordDelivery(guide(), 3, 4, dto);
    await expect(harness.service.recordDelivery(guide(), 3, 4, dto)).rejects.toBeInstanceOf(ConflictException);
    await expect(
      harness.service.recordDelivery(guide(), 3, 9, { ...dto, deliveredOn: '2099-01-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      harness.service.recordDelivery({ id: 8, roles: ['Docente'], permissions: [] } as never, 3, 4, dto),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('guarda el acuse opcional como evidencia de entrega', async () => {
    const harness = createHarness({ guardians: [], notifiedAt: new Date(), status: DisciplinaryCaseStatus.NOTIFIED });
    const directory = mkdtempSync(join(tmpdir(), 'disciplinary-delivery-'));
    (harness.service as unknown as { storageRoot: string }).storageRoot = directory;
    try {
      const result = await harness.service.recordDelivery(
        guide(),
        3,
        4,
        { medium: DeliveryMedium.NOTEBOOK, deliveredOn: '2026-10-16', receivedByName: 'María Solano' },
        { originalname: 'acuse.pdf', mimetype: 'application/pdf', size: 8, buffer: Buffer.from('%PDF-1.4') } as never,
      );
      expect(result.evidenceId).toBe(1);
      expect(harness.evidences[0]).toMatchObject({ context: 'DELIVERY', originalName: 'acuse.pdf' });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('sin encargado, la entrega física abre la comunicación formal y el plazo de descargo', async () => {
    const harness = createHarness({ guardians: [], notifiedAt: null, status: DisciplinaryCaseStatus.INVESTIGATING });
    const result = await harness.service.deliverFormalCharge(guide(), 3, {
      medium: DeliveryMedium.IN_PERSON,
      deliveredOn: '2026-10-16',
      receivedByName: 'María Solano',
      proposedAction: 'Amonestación escrita y entrevista con el encargado.',
    });
    expect(result).toMatchObject({
      status: DisciplinaryCaseStatus.COMMUNICATED,
      stepStartedOn: '2026-10-16',
      stepBusinessDays: 3,
    });
    expect(harness.row.notifiedAt).toEqual(new Date('2026-10-16T18:00:00.000Z'));
    const formal = [...harness.communications.values()].find((item) => item.id !== 4);
    expect(formal?.deliveryMedium).toBe(DeliveryMedium.IN_PERSON);
    expect(formal?.body).toEqual(expect.stringContaining('Agresión'));
    for (const clause of MANDATORY_CLAUSES) {
      expect(formal?.body).toEqual(expect.stringContaining(clause));
    }
    expect(harness.mail.sendMail).not.toHaveBeenCalled();
  });

  it('si hay encargado vinculado no crea otra comunicación formal por entrega física', async () => {
    const harness = createHarness({
      guardians: [{ id: 70, email: 'encargado@colegio.cr' }],
      notifiedAt: null,
      status: DisciplinaryCaseStatus.INVESTIGATING,
    });
    await expect(
      harness.service.deliverFormalCharge(guide(), 3, {
        medium: DeliveryMedium.NOTEBOOK,
        deliveredOn: '2026-10-16',
        receivedByName: 'María Solano',
        proposedAction: 'Amonestación escrita y entrevista con el encargado.',
      }),
    ).rejects.toMatchObject({ response: { code: 'GUARDIANS_LINKED' } });
    expect(harness.row.status).toBe(DisciplinaryCaseStatus.INVESTIGATING);
  });

  it('imprime el PDF a quien puede ver el expediente y lo niega a un docente ajeno', async () => {
    const harness = createHarness({ guardians: [], notifiedAt: null, status: DisciplinaryCaseStatus.NOTIFIED });
    const file = await harness.service.pdf(
      { id: 1, roles: ['Administrador'], permissions: [PERMISSIONS.DISCIPLINARY_READ] } as never,
      3,
      4,
    );
    expect(file).toBeInstanceOf(StreamableFile);
    const chunks: Buffer[] = [];
    for await (const chunk of file.getStream()) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    expect(Buffer.concat(chunks).subarray(0, 5).toString()).toBe('%PDF-');

    await expect(
      harness.service.pdf(
        { id: 8, roles: ['Docente'], permissions: [PERMISSIONS.DISCIPLINARY_VIEW_OWN] } as never,
        3,
        4,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

function guide() {
  return { id: 7, roles: ['Docente'], permissions: [] } as never;
}

function createHarness(input: {
  guardians: Array<{ id: number; email: string | null }>;
  notifiedAt: Date | null;
  status: DisciplinaryCaseStatus;
  stepStartedOn?: string;
}) {
  const row = {
    id: 3,
    track: input.status === DisciplinaryCaseStatus.NOTIFIED ? DisciplinaryTrack.DIRECT : DisciplinaryTrack.DUE_PROCESS,
    status: input.status,
    responsibleUserId: 7,
    reporterUserId: 4,
    studentUserId: 10,
    groupId: 2,
    infractionTypeId: 5,
    severity: input.status === DisciplinaryCaseStatus.NOTIFIED ? InfractionSeverity.MINOR : InfractionSeverity.SERIOUS,
    caseNumber: 'AM-2026-0008',
    occurredAt: new Date('2026-10-13T15:00:00.000Z'),
    place: 'aula 2',
    description: 'Empujó a un compañero durante el recreo.',
    notifiedAt: input.notifiedAt,
    stepStartedOn: input.stepStartedOn ?? '2026-10-10',
    stepBusinessDays: 3,
  } as DisciplinaryCaseEntity;
  const communications = new Map<number, DisciplinaryCommunicationEntity>();
  communications.set(4, {
    id: 4,
    caseId: 3,
    kind: input.status === DisciplinaryCaseStatus.NOTIFIED ? CommunicationKind.DIRECT_REPRIMAND : CommunicationKind.FORMAL_CHARGE,
    body: 'Texto del acto ya comunicado.',
    issuerUserId: 7,
    issuedAt: new Date('2026-10-14T18:00:00.000Z'),
    deliveryMedium: null,
    deliveredAt: null,
    deliveredByUserId: null,
    receivedByName: null,
  } as DisciplinaryCommunicationEntity);
  const events: DisciplinaryCaseEventEntity[] = [];
  const evidences: Array<Record<string, unknown>> = [];
  let nextId = 20;
  const eventRepo = {
    create: (value: Partial<DisciplinaryCaseEventEntity>) => value,
    save: async (value: Partial<DisciplinaryCaseEventEntity>) => {
      const stored = { id: nextId++, ...value } as DisciplinaryCaseEventEntity;
      events.push(stored);
      return stored;
    },
  };
  const communicationRepo = {
    create: (value: Partial<DisciplinaryCommunicationEntity>) => value,
    save: async (value: Partial<DisciplinaryCommunicationEntity>) => {
      const stored = { id: nextId++, deliveryMedium: null, ...value } as DisciplinaryCommunicationEntity;
      communications.set(stored.id, stored);
      return stored;
    },
    findOne: async (query: { where: { id: number; caseId: number } }) => {
      const found = communications.get(query.where.id);
      return found && found.caseId === query.where.caseId ? found : null;
    },
    update: async (id: number, patch: Partial<DisciplinaryCommunicationEntity>) => {
      const found = communications.get(id);
      if (found) Object.assign(found, patch);
    },
  };
  const manager = {
    query: async () => input.guardians,
    update: async (entity: unknown, _id: number, patch: Partial<DisciplinaryCaseEntity>) => {
      if (entity === DisciplinaryCaseEntity) Object.assign(row, patch);
    },
    getRepository: (entity: unknown) => {
      if (entity === DisciplinaryCaseEventEntity) return eventRepo;
      if (entity === AuditLog) return { create: (value: unknown) => value, save: async (value: unknown) => value };
      if (entity === DisciplinaryCommunicationEntity) return communicationRepo;
      if (entity === DisciplinaryNotificationEntity) {
        return { create: (value: unknown) => value, save: async (value: unknown) => ({ id: nextId++, ...(value as object) }) };
      }
      if (entity === InfractionTypeEntity) return { findOne: async () => ({ id: 5, name: 'Agresión' }) };
      if (entity === DisciplinaryEvidenceEntity) {
        return {
          create: (value: Record<string, unknown>) => value,
          save: async (value: Record<string, unknown>) => {
            const stored = { id: evidences.length + 1, ...value };
            evidences.push(stored);
            return stored;
          },
        };
      }
      throw new Error('Repositorio no previsto');
    },
  };
  const dataSource = {
    query: async () => [],
    getRepository: (entity: unknown) => {
      if (entity === DisciplinaryCaseEntity) return { findOne: async () => row };
      if (entity === DisciplinaryCommunicationEntity) return communicationRepo;
      throw new Error('Repositorio no previsto');
    },
    transaction: async (work: (current: typeof manager) => Promise<unknown>) => work(manager),
  };
  const mail = { sendMail: jest.fn() };
  const service = new DisciplinaryDeliveryService(
    dataSource as never,
    new DisciplinaryWorkflowService(),
    new DisciplinaryCommunicationsService(mail as never, { update: jest.fn() } as never),
    new DisciplinaryAccessService(),
  );
  return { row, communication: communications.get(4)!, communications, events, evidences, mail, service };
}
