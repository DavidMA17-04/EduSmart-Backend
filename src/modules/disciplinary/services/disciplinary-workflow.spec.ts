import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { DisciplinaryCaseStatus, DisciplinaryTrack } from '../constants/disciplinary.enums';
import { DisciplinaryWorkflowService } from './disciplinary-workflow.service';
import { canTransition } from './disciplinary-workflow';

describe('transiciones del expediente', () => {
  const due = DisciplinaryTrack.DUE_PROCESS;
  const direct = DisciplinaryTrack.DIRECT;

  it('acepta el recorrido del debido proceso', () => {
    const steps: Array<[DisciplinaryCaseStatus, DisciplinaryCaseStatus]> = [
      [DisciplinaryCaseStatus.REPORTED, DisciplinaryCaseStatus.INVESTIGATING],
      [DisciplinaryCaseStatus.INVESTIGATING, DisciplinaryCaseStatus.COMMUNICATED],
      [DisciplinaryCaseStatus.COMMUNICATED, DisciplinaryCaseStatus.PENDING_RESOLUTION],
      [DisciplinaryCaseStatus.PENDING_RESOLUTION, DisciplinaryCaseStatus.RESOLVED],
      [DisciplinaryCaseStatus.RESOLVED, DisciplinaryCaseStatus.IN_APPEAL],
      [DisciplinaryCaseStatus.IN_APPEAL, DisciplinaryCaseStatus.FIRM],
    ];
    for (const [from, to] of steps) {
      expect(canTransition(due, from, to)).toBe(true);
    }
    expect(canTransition(due, DisciplinaryCaseStatus.INVESTIGATING, DisciplinaryCaseStatus.DISMISSED)).toBe(
      true,
    );
    expect(canTransition(due, DisciplinaryCaseStatus.RESOLVED, DisciplinaryCaseStatus.DISMISSED)).toBe(true);
    expect(canTransition(due, DisciplinaryCaseStatus.IN_APPEAL, DisciplinaryCaseStatus.DISMISSED)).toBe(true);
  });

  it('rechaza resolver un expediente que sigue en investigación', () => {
    expect(
      canTransition(due, DisciplinaryCaseStatus.INVESTIGATING, DisciplinaryCaseStatus.RESOLVED),
    ).toBe(false);
    const service = new DisciplinaryWorkflowService();
    expect(() =>
      service.assertTransition(due, DisciplinaryCaseStatus.INVESTIGATING, DisciplinaryCaseStatus.RESOLVED),
    ).toThrow(BadRequestException);
  });

  it('la vía directa solo usa Notificada, En recurso, Firme, Desestimada y Anulada', () => {
    expect(canTransition(direct, DisciplinaryCaseStatus.NOTIFIED, DisciplinaryCaseStatus.IN_APPEAL)).toBe(true);
    expect(canTransition(direct, DisciplinaryCaseStatus.IN_APPEAL, DisciplinaryCaseStatus.FIRM)).toBe(true);
    expect(canTransition(direct, DisciplinaryCaseStatus.IN_APPEAL, DisciplinaryCaseStatus.DISMISSED)).toBe(true);
    expect(canTransition(direct, DisciplinaryCaseStatus.NOTIFIED, DisciplinaryCaseStatus.INVESTIGATING)).toBe(
      false,
    );
    expect(canTransition(direct, DisciplinaryCaseStatus.REPORTED, DisciplinaryCaseStatus.INVESTIGATING)).toBe(
      false,
    );
  });

  it('anula un estado no final o firme, y no reabre uno anulado', () => {
    expect(canTransition(due, DisciplinaryCaseStatus.COMMUNICATED, DisciplinaryCaseStatus.ANNULLED)).toBe(true);
    expect(canTransition(direct, DisciplinaryCaseStatus.NOTIFIED, DisciplinaryCaseStatus.ANNULLED)).toBe(true);
    expect(canTransition(due, DisciplinaryCaseStatus.FIRM, DisciplinaryCaseStatus.ANNULLED)).toBe(true);
    expect(canTransition(direct, DisciplinaryCaseStatus.FIRM, DisciplinaryCaseStatus.ANNULLED)).toBe(true);
    expect(canTransition(due, DisciplinaryCaseStatus.ANNULLED, DisciplinaryCaseStatus.FIRM)).toBe(false);
    expect(canTransition(due, DisciplinaryCaseStatus.DISMISSED, DisciplinaryCaseStatus.REPORTED)).toBe(false);
  });

  it('escribe el cambio, la bitácora y la auditoría en el mismo manager', async () => {
    const saved: Array<{ entity: string; row: Record<string, unknown> }> = [];
    const updates: unknown[] = [];
    const manager = {
      update: jest.fn(async (...args: unknown[]) => {
        updates.push(args);
      }),
      getRepository: (entity: { name: string }) => ({
        create: (row: Record<string, unknown>) => row,
        save: jest.fn(async (row: Record<string, unknown>) => {
          saved.push({ entity: entity.name, row });
          return row;
        }),
      }),
    };
    const at = new Date('2026-10-19T15:00:00.000Z');
    await new DisciplinaryWorkflowService().apply(manager as unknown as EntityManager, {
      caseId: 8,
      track: due,
      from: DisciplinaryCaseStatus.REPORTED,
      to: DisciplinaryCaseStatus.INVESTIGATING,
      actorUserId: 4,
      note: 'Inicio de investigación',
      at,
    });

    expect(updates).toHaveLength(1);
    expect(saved).toEqual([
      expect.objectContaining({
        entity: 'DisciplinaryCaseEventEntity',
        row: expect.objectContaining({
          caseId: 8,
          fromStatus: DisciplinaryCaseStatus.REPORTED,
          toStatus: DisciplinaryCaseStatus.INVESTIGATING,
          actorUserId: 4,
          payload: { note: 'Inicio de investigación' },
        }),
      }),
      expect.objectContaining({
        entity: 'AuditLog',
        row: expect.objectContaining({
          actorId: 4,
          entity: 'disciplinary_cases',
          entityId: '8',
          before: { status: DisciplinaryCaseStatus.REPORTED },
          after: { status: DisciplinaryCaseStatus.INVESTIGATING, note: 'Inicio de investigación' },
        }),
      }),
    ]);
  });

  it('no escribe nada si la transición es inválida', async () => {
    const manager = { update: jest.fn(), getRepository: jest.fn() };
    await expect(
      new DisciplinaryWorkflowService().apply(manager as unknown as EntityManager, {
        caseId: 8,
        track: due,
        from: DisciplinaryCaseStatus.INVESTIGATING,
        to: DisciplinaryCaseStatus.RESOLVED,
        actorUserId: 4,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(manager.update).not.toHaveBeenCalled();
    expect(manager.getRepository).not.toHaveBeenCalled();
  });
});
