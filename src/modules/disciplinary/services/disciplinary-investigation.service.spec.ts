import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { InfractionSeverity } from '../constants/infraction-severity.constant';
import { DisciplinaryCaseStatus, DisciplinaryTrack, ResolutionOutcome } from '../constants/disciplinary.enums';
import { DisciplinaryCaseEntity } from '../entities/disciplinary-case.entity';
import { DisciplinaryInvestigationService } from './disciplinary-investigation.service';
import { DisciplinaryWorkflowService } from './disciplinary-workflow.service';
import { INVESTIGATION_BUSINESS_DAYS } from './investigation';

function openCase(partial: Partial<DisciplinaryCaseEntity> = {}): DisciplinaryCaseEntity {
  return {
    id: 3,
    track: DisciplinaryTrack.DUE_PROCESS,
    status: DisciplinaryCaseStatus.REPORTED,
    responsibleUserId: 7,
    reporterUserId: 4,
    ...partial,
  } as DisciplinaryCaseEntity;
}

describe('DisciplinaryInvestigationService', () => {
  it('el docente guía inicia la investigación y abre 10 días hábiles', async () => {
    const updates: unknown[] = [];
    const apply = jest.fn();
    const service = build(openCase(), {
      apply,
      update: async (_entity: unknown, _id: number, patch: unknown) => {
        updates.push(patch);
      },
    });
    const result = await service.start({ id: 7, roles: ['Docente'], permissions: [] } as never, 3);
    expect(apply).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ from: 'REPORTED', to: 'INVESTIGATING', actorUserId: 7 }),
    );
    expect(updates).toEqual([
      expect.objectContaining({ stepBusinessDays: INVESTIGATION_BUSINESS_DAYS }),
    ]);
    expect(result.status).toBe(DisciplinaryCaseStatus.INVESTIGATING);
    expect(result.stepBusinessDays).toBe(10);
  });

  it('un docente ajeno no registra observaciones', async () => {
    const service = build(openCase({ status: DisciplinaryCaseStatus.INVESTIGATING }));
    await expect(
      service.observe({ id: 4, roles: ['Docente'], permissions: [] } as never, 3, {
        message: 'Observación de la investigación.',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('el docente que reportó responde la solicitud y no puede responderla dos veces', async () => {
    const saved: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const requests = [
      { id: 9, caseId: 3, type: 'INFO_REQUEST', payload: { message: 'Detalle', recipientUserId: 4 } },
    ];
    const service = build(openCase({ status: DisciplinaryCaseStatus.INVESTIGATING }), {
      events: {
        findOne: async () => requests[0],
        find: async () => saved.filter((row) => row.type === 'INFO_RESPONSE'),
        save: async (row: { type: string; payload: Record<string, unknown> }) => {
          saved.push(row);
          return { ...row, id: 15 };
        },
        create: (row: { type: string; payload: Record<string, unknown> }) => row,
      },
    });
    const actor = { id: 4, roles: ['Docente'], permissions: [] } as never;
    const answer = await service.respond(actor, 3, {
      requestEventId: 9,
      message: 'El estudiante salió del aula sin permiso.',
    });
    expect(answer.requestEventId).toBe(9);
    await expect(
      service.respond(actor, 3, { requestEventId: 9, message: 'Otra respuesta que no debe guardarse.' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('Dirección solicita información al docente que reportó', async () => {
    const service = build(openCase({ status: DisciplinaryCaseStatus.INVESTIGATING }), {
      events: {
        save: async (row: { type: string }) => ({ ...row, id: 11 }),
        create: (row: { type: string }) => row,
      },
    });
    const result = await service.requestInformation(
      { id: 2, roles: ['Director'], permissions: [] } as never,
      3,
      { message: 'Indique quiénes estaban presentes.' },
    );
    expect(result).toEqual({ id: 11, type: 'INFO_REQUEST', recipientUserId: 4 });
  });

  it('el responsable solicita el criterio reservado y el expediente no cambia de estado', async () => {
    const saved: Array<{ type: string; visibility: string }> = [];
    const apply = jest.fn();
    const service = build(openCase({ status: DisciplinaryCaseStatus.INVESTIGATING }), {
      apply,
      events: {
        find: async () => saved,
        create: (row: { type: string; visibility: string }) => row,
        save: async (row: { type: string; visibility: string }) => {
          saved.push(row);
          return { ...row, id: 21 };
        },
      },
    });
    const result = await service.requestCounsel(
      { id: 7, roles: ['Docente'], permissions: [] } as never,
      3,
      { message: 'Solicito criterio sobre el contexto familiar.' },
    );
    expect(result).toMatchObject({ type: 'COUNSEL_REQUEST', visibility: 'RESERVED', status: 'INVESTIGATING' });
    expect(saved[0].visibility).toBe('RESERVED');
    expect(apply).not.toHaveBeenCalled();
  });

  it('Orientación emite el criterio reservado y un docente no puede emitirlo', async () => {
    const requests = [{ id: 21, caseId: 3, type: 'COUNSEL_REQUEST', payload: { message: 'Solicito criterio' } }];
    const service = build(openCase({ status: DisciplinaryCaseStatus.INVESTIGATING }), {
      events: {
        find: async () => requests,
        create: (row: { visibility: string; payload: { requestEventId: number } }) => row,
        save: async (row: { visibility: string; payload: { requestEventId: number } }) => ({ ...row, id: 22 }),
      },
    });
    await expect(
      service.issueCounsel({ id: 4, roles: ['Docente'], permissions: [] } as never, 3, {
        message: 'Criterio técnico de acompañamiento.',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const opinion = await service.issueCounsel(
      { id: 9, roles: ['Orientador'], permissions: ['disciplinary.review'] } as never,
      3,
      { message: 'Criterio técnico de acompañamiento, no vinculante.' },
    );
    expect(opinion).toMatchObject({ type: 'COUNSEL_OPINION', visibility: 'RESERVED', status: 'INVESTIGATING' });
  });

  it('Modifica baja la gravedad, deja el expediente Resuelta y comunica la resolución', async () => {
    const patches: Array<Record<string, unknown>> = [];
    const issue = jest.fn().mockResolvedValue({ communicationId: 30, pending: [{ id: 1 }], notified: true });
    const dispatch = jest.fn();
    const service = build(
      openCase({
        status: DisciplinaryCaseStatus.PENDING_RESOLUTION,
        severity: InfractionSeverity.VERY_SERIOUS,
        caseNumber: 'AM-2026-0004',
        studentUserId: 10,
      }),
      {
        update: async (_entity, _id, patch) => {
          patches.push(patch as Record<string, unknown>);
        },
        communications: { issue, dispatch },
      },
    );
    const reasoning = 'Se valora el descargo y se reduce la gravedad porque el hecho no alcanzó la lesividad descrita.';
    const result = await service.resolve(guide(), 3, {
      outcome: ResolutionOutcome.MODIFY,
      reasoning,
      severity: InfractionSeverity.SERIOUS,
    });
    expect(result).toMatchObject({
      status: DisciplinaryCaseStatus.RESOLVED,
      severity: InfractionSeverity.SERIOUS,
      deduction: 20,
      communicationId: 30,
      stepBusinessDays: 3,
    });
    expect(issue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ kind: 'RESOLUTION', subject: 'Resolución AM-2026-0004' }),
    );
    expect(patches[0]).toEqual(expect.objectContaining({ resolutionOutcome: 'MODIFY', severity: 'SERIOUS' }));
    expect(dispatch).toHaveBeenCalled();
  });

  it('rechaza una fundamentación de menos de 50 caracteres y a un docente ajeno', async () => {
    const service = build(openCase({ status: DisciplinaryCaseStatus.PENDING_RESOLUTION, severity: InfractionSeverity.SERIOUS }));
    await expect(
      service.resolve(guide(), 3, { outcome: ResolutionOutcome.UPHOLD, reasoning: 'Muy corta' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.resolve({ id: 4, roles: ['Docente'], permissions: [] } as never, 3, {
        outcome: ResolutionOutcome.UPHOLD,
        reasoning: 'Fundamentación suficiente para valorar el descargo presentado por el estudiante.',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('no resuelve un expediente que sigue en investigación', async () => {
    const service = build(
      openCase({ status: DisciplinaryCaseStatus.INVESTIGATING, severity: InfractionSeverity.SERIOUS }),
      { workflow: new DisciplinaryWorkflowService() },
    );
    await expect(
      service.resolve(guide(), 3, {
        outcome: ResolutionOutcome.DISMISS,
        reasoning: 'Se desestima porque no hay elementos suficientes para sostener la falta reportada.',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('archiva por falta de mérito y deja el expediente Desestimada', async () => {
    const patches: Array<Record<string, unknown>> = [];
    const apply = jest.fn();
    const service = build(openCase({ status: DisciplinaryCaseStatus.INVESTIGATING }), {
      apply,
      update: async (_entity, _id, patch) => {
        patches.push(patch as Record<string, unknown>);
      },
    });
    const result = await service.archive(guide(), 3, {
      reason: 'No hay mérito para continuar la investigación.',
    });
    expect(result.status).toBe(DisciplinaryCaseStatus.DISMISSED);
    expect(apply).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ from: 'INVESTIGATING', to: 'DISMISSED' }),
    );
    expect(patches[0]).toEqual(expect.objectContaining({ resolutionOutcome: 'DISMISS' }));
  });

  it('anula un expediente firme con justificación y niega a quien no configura', async () => {
    const patches: Array<Record<string, unknown>> = [];
    const apply = jest.fn();
    const service = build(
      openCase({ status: DisciplinaryCaseStatus.FIRM, track: DisciplinaryTrack.DUE_PROCESS }),
      {
        apply,
        update: async (_entity, _id, patch) => {
          patches.push(patch as Record<string, unknown>);
        },
      },
    );
    await expect(
      service.annul(guide(), 3, { reason: 'Justificación que no debe aceptarse al docente.' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const result = await service.annul(
      { id: 1, roles: ['Administrador'], permissions: ['disciplinary.configure'] } as never,
      3,
      { reason: 'Se anula porque el expediente firme se abrió sobre un estudiante equivocado.' },
    );
    expect(result.status).toBe(DisciplinaryCaseStatus.ANNULLED);
    expect(apply).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ from: 'FIRM', to: 'ANNULLED' }),
    );
    expect(patches[0].annulReason).toContain('estudiante equivocado');
  });

  it('no emite criterio si nadie lo solicitó', async () => {
    const service = build(openCase({ status: DisciplinaryCaseStatus.INVESTIGATING }));
    await expect(
      service.issueCounsel(
        { id: 9, roles: ['Orientador'], permissions: ['disciplinary.review'] } as never,
        3,
        { message: 'Criterio sin una solicitud previa.' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

function guide() {
  return { id: 7, roles: ['Docente'], permissions: [] } as never;
}

function build(
  row: DisciplinaryCaseEntity,
  hooks: {
    apply?: jest.Mock;
    workflow?: DisciplinaryWorkflowService;
    update?: (entity: unknown, id: number, patch: unknown) => Promise<void>;
    events?: Record<string, unknown>;
    communications?: { issue: jest.Mock; dispatch: jest.Mock };
  } = {},
) {
  const eventRepo = {
    findOne: async () => null,
    find: async () => [],
    save: async (value: { id?: number }) => ({ id: 20, ...value }),
    create: (value: unknown) => value,
    ...hooks.events,
  };
  const manager = {
    update: hooks.update ?? (async () => undefined),
    getRepository: () => eventRepo,
  };
  const dataSource = {
    getRepository: () => ({ findOne: async () => row }),
    transaction: async (work: (current: typeof manager) => Promise<unknown>) => work(manager),
  };
  const communications = hooks.communications ?? {
    issue: jest.fn().mockResolvedValue({ communicationId: 1, pending: [], notified: false }),
    dispatch: jest.fn(),
  };
  const workflow = hooks.workflow ?? { apply: hooks.apply ?? jest.fn() };
  return new DisciplinaryInvestigationService(dataSource as never, workflow as never, communications as never);
}
