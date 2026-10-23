import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { FollowUpKind, FollowUpOutcome } from '../constants/disciplinary.enums';
import { DisciplinaryCaseEntity } from '../entities/disciplinary-case.entity';
import { DisciplinaryFollowUpEntity } from '../entities/disciplinary-follow-up.entity';
import { DisciplinaryFollowUpService } from './disciplinary-follow-up.service';

describe('DisciplinaryFollowUpService', () => {
  it('registra un compromiso y lo deja en la cronología', async () => {
    const events: unknown[] = [];
    const service = build({ responsibleUserId: 7 }, { events });
    const saved = await service.create(guide(), 3, {
      kind: FollowUpKind.COMMITMENT,
      followedOn: '2026-10-01',
      description: 'El estudiante se compromete a llegar puntual.',
      reviewOn: '2026-10-30',
    });
    expect(saved.outcome).toBe(FollowUpOutcome.PENDING);
    expect(events).toEqual([
      expect.objectContaining({ type: 'FOLLOW_UP', payload: expect.objectContaining({ kind: 'COMMITMENT' }) }),
    ]);
  });

  it('un docente ajeno no registra seguimiento', async () => {
    const service = build({ responsibleUserId: 7 });
    await expect(
      service.create({ id: 4, roles: ['Docente'], permissions: [] } as never, 3, {
        kind: FollowUpKind.OBSERVATION,
        followedOn: '2026-10-01',
        description: 'Observación de un docente que no es el guía.',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('marca el compromiso como incumplido sin cambiar la descripción original', async () => {
    const updates: unknown[] = [];
    const original = 'El estudiante se compromete a llegar puntual.';
    const service = build(
      { responsibleUserId: 7 },
      {
        followUp: {
          id: 8,
          caseId: 3,
          kind: FollowUpKind.COMMITMENT,
          followedOn: '2026-10-01',
          description: original,
          participants: null,
          reviewOn: '2026-10-30',
          outcome: FollowUpOutcome.PENDING,
          outcomeNote: null,
          authorUserId: 7,
        },
        update: async (_entity: unknown, _id: number, patch: unknown) => {
          updates.push(patch);
        },
      },
    );
    const closed = await service.close(guide(), 3, 8, {
      outcome: FollowUpOutcome.UNMET,
      note: 'No cumplió la puntualidad esta semana.',
    });
    expect(closed.description).toBe(original);
    expect(closed.outcome).toBe(FollowUpOutcome.UNMET);
    expect(updates).toEqual([{ outcome: FollowUpOutcome.UNMET, outcomeNote: 'No cumplió la puntualidad esta semana.' }]);
  });

  it('exige fecha de revisión en un compromiso', async () => {
    const service = build({ responsibleUserId: 7 });
    await expect(
      service.create(guide(), 3, {
        kind: FollowUpKind.COMMITMENT,
        followedOn: '2026-10-01',
        description: 'Compromiso sin fecha de revisión.',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

function guide() {
  return { id: 7, roles: ['Docente'], permissions: [] } as never;
}

function build(
  row: Partial<DisciplinaryCaseEntity>,
  hooks: {
    events?: unknown[];
    followUp?: Partial<DisciplinaryFollowUpEntity> | null;
    update?: (entity: unknown, id: number, patch: unknown) => Promise<void>;
  } = {},
) {
  const followRepo = {
    create: (value: unknown) => value,
    save: async (value: Record<string, unknown>) => ({ id: 8, outcomeNote: null, participants: null, ...value }),
  };
  const eventRepo = {
    create: (value: unknown) => value,
    save: async (value: unknown) => {
      hooks.events?.push(value);
      return value;
    },
  };
  const manager = {
    getRepository: (entity: unknown) => (entity === DisciplinaryFollowUpEntity ? followRepo : eventRepo),
    update: hooks.update ?? (async () => undefined),
  };
  const dataSource = {
    transaction: async (work: (current: typeof manager) => Promise<unknown>) => work(manager),
    query: jest.fn(),
    getRepository: () => eventRepo,
  };
  return new DisciplinaryFollowUpService(
    dataSource as never,
    { findOne: async () => hooks.followUp ?? null } as never,
    { findOne: async () => ({ id: 3, responsibleUserId: 7, ...row }) } as never,
  );
}
