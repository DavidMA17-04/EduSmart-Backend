import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuditLog } from '../../administrative/users/entities/audit-log.entity';
import { InfractionSeverity } from '../constants/infraction-severity.constant';
import {
  DisciplinaryCaseStatus,
  DisciplinaryTrack,
  ResolutionOutcome,
} from '../constants/disciplinary.enums';
import { DisciplinaryCaseEntity } from '../entities/disciplinary-case.entity';
import { DisciplinaryCaseEventEntity } from '../entities/disciplinary-case-event.entity';
import { DisciplinaryCommunicationsService } from './disciplinary-communications.service';
import { DisciplinaryInvestigationService } from './disciplinary-investigation.service';
import { DisciplinaryWorkflowService } from './disciplinary-workflow.service';

/**
 * Recorre el mismo expediente desde Reportada hasta Resuelta.
 * El descargo todavía no tiene endpoint (tarea 4.5). Esta prueba aplica las
 * transiciones del flujo de estados para llegar a la resolución.
 */
describe('flujo de investigación y resolución', () => {
  it('investiga, pide criterio, rechaza resolver antes de tiempo y resuelve al quedar pendiente', async () => {
    const harness = createHarness();
    const guide = actor(7, ['Docente']);
    const reporter = actor(4, ['Docente']);
    const outsider = actor(8, ['Docente']);
    const counselor = actor(9, ['Orientador'], ['disciplinary.review']);

    const started = await harness.service.start(guide, 3);
    expect(started).toMatchObject({ status: 'INVESTIGATING', stepBusinessDays: 10 });
    expect(harness.row.status).toBe(DisciplinaryCaseStatus.INVESTIGATING);

    await expect(
      harness.service.observe(outsider, 3, { message: 'Observación de un docente ajeno.' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await harness.service.observe(guide, 3, { message: 'Se entrevistó al grupo presente.' });
    const request = await harness.service.requestInformation(guide, 3, {
      message: 'Indique quiénes estaban en el aula.',
    });
    expect(request.recipientUserId).toBe(4);
    await harness.service.respond(reporter, 3, {
      requestEventId: request.id,
      message: 'El estudiante salió del aula sin permiso.',
    });

    await harness.service.requestCounsel(guide, 3, {
      message: 'Solicito criterio sobre el contexto familiar.',
    });
    const opinion = await harness.service.issueCounsel(counselor, 3, {
      message: 'Criterio técnico de acompañamiento, no vinculante.',
    });
    expect(opinion).toMatchObject({ type: 'COUNSEL_OPINION', visibility: 'RESERVED', status: 'INVESTIGATING' });
    expect(harness.row.status).toBe(DisciplinaryCaseStatus.INVESTIGATING);

    await expect(
      harness.service.resolve(guide, 3, {
        outcome: ResolutionOutcome.MODIFY,
        severity: InfractionSeverity.SERIOUS,
        reasoning: 'Fundamentación que no debe aceptarse mientras el expediente sigue en investigación.',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await harness.workflow.apply(harness.manager, {
      caseId: 3,
      track: DisciplinaryTrack.DUE_PROCESS,
      from: DisciplinaryCaseStatus.INVESTIGATING,
      to: DisciplinaryCaseStatus.COMMUNICATED,
      actorUserId: 7,
      note: 'Comunicación formal',
    });
    await harness.workflow.apply(harness.manager, {
      caseId: 3,
      track: DisciplinaryTrack.DUE_PROCESS,
      from: DisciplinaryCaseStatus.COMMUNICATED,
      to: DisciplinaryCaseStatus.PENDING_RESOLUTION,
      actorUserId: 7,
      note: 'Descargo recibido',
    });

    const resolved = await harness.service.resolve(guide, 3, {
      outcome: ResolutionOutcome.MODIFY,
      severity: InfractionSeverity.SERIOUS,
      reasoning: 'Se valora el descargo y se reduce la gravedad porque el hecho no alcanzó la lesividad descrita.',
    });

    expect(resolved).toMatchObject({
      status: DisciplinaryCaseStatus.RESOLVED,
      severity: InfractionSeverity.SERIOUS,
      deduction: 20,
      stepBusinessDays: 3,
    });
    expect(harness.row.status).toBe(DisciplinaryCaseStatus.RESOLVED);
    expect(harness.row.resolutionOutcome).toBe(ResolutionOutcome.MODIFY);
    expect(harness.issue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ kind: 'RESOLUTION', subject: 'Resolución AM-2026-0008' }),
    );
    expect(harness.dispatch).toHaveBeenCalled();

    const changes = harness.events
      .filter((event) => event.type === 'STATUS_CHANGE')
      .map((event) => [event.fromStatus, event.toStatus]);
    expect(changes).toEqual([
      ['REPORTED', 'INVESTIGATING'],
      ['INVESTIGATING', 'COMMUNICATED'],
      ['COMMUNICATED', 'PENDING_RESOLUTION'],
      ['PENDING_RESOLUTION', 'RESOLVED'],
    ]);
    expect(harness.audits.map((entry) => entry.after)).toEqual([
      expect.objectContaining({ status: 'INVESTIGATING' }),
      expect.objectContaining({ status: 'COMMUNICATED' }),
      expect.objectContaining({ status: 'PENDING_RESOLUTION' }),
      expect.objectContaining({ status: 'RESOLVED' }),
    ]);
    expect(harness.events.map((event) => event.type)).toEqual([
      'STATUS_CHANGE',
      'OBSERVATION',
      'INFO_REQUEST',
      'INFO_RESPONSE',
      'COUNSEL_REQUEST',
      'COUNSEL_OPINION',
      'STATUS_CHANGE',
      'STATUS_CHANGE',
      'STATUS_CHANGE',
    ]);
  });
});

function actor(id: number, roles: string[], permissions: string[] = []) {
  return { id, roles, permissions } as never;
}

function createHarness() {
  const row = {
    id: 3,
    track: DisciplinaryTrack.DUE_PROCESS,
    status: DisciplinaryCaseStatus.REPORTED,
    responsibleUserId: 7,
    reporterUserId: 4,
    severity: InfractionSeverity.VERY_SERIOUS,
    caseNumber: 'AM-2026-0008',
    studentUserId: 10,
  } as DisciplinaryCaseEntity;
  const events: DisciplinaryCaseEventEntity[] = [];
  const audits: AuditLog[] = [];
  let nextId = 1;

  const eventRepo = {
    create: (value: Partial<DisciplinaryCaseEventEntity>) => value,
    save: async (value: Partial<DisciplinaryCaseEventEntity>) => {
      const saved = { id: nextId++, visibility: 'PUBLIC', ...value } as DisciplinaryCaseEventEntity;
      events.push(saved);
      return saved;
    },
    find: async (query?: { where?: Record<string, unknown> }) => events.filter((event) => matches(event, query?.where)),
    findOne: async (query?: { where?: Record<string, unknown> }) =>
      events.find((event) => matches(event, query?.where)) ?? null,
  };
  const auditRepo = {
    create: (value: Partial<AuditLog>) => value,
    save: async (value: Partial<AuditLog>) => {
      const saved = value as AuditLog;
      audits.push(saved);
      return saved;
    },
  };
  const manager = {
    update: async (entity: unknown, _id: number, patch: Partial<DisciplinaryCaseEntity>) => {
      if (entity === DisciplinaryCaseEntity) Object.assign(row, patch);
    },
    getRepository: (entity: unknown) => {
      if (entity === DisciplinaryCaseEventEntity) return eventRepo;
      if (entity === AuditLog) return auditRepo;
      throw new Error('Repositorio no previsto en el flujo');
    },
  };
  const dataSource = {
    getRepository: () => ({ findOne: async () => row }),
    transaction: async (work: (current: typeof manager) => Promise<unknown>) => work(manager),
  };
  const issue = jest.fn().mockResolvedValue({ communicationId: 40, pending: [{ id: 1 }], notified: true });
  const dispatch = jest.fn();
  const communications = { issue, dispatch } as unknown as DisciplinaryCommunicationsService;
  const workflow = new DisciplinaryWorkflowService();
  return {
    row,
    events,
    audits,
    manager: manager as never,
    workflow,
    issue,
    dispatch,
    service: new DisciplinaryInvestigationService(dataSource as never, workflow, communications),
  };
}

function matches(event: DisciplinaryCaseEventEntity, where?: Record<string, unknown>): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, value]) => event[key as keyof DisciplinaryCaseEventEntity] === value);
}
