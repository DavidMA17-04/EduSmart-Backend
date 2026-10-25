import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { AuditLog } from '../../administrative/users/entities/audit-log.entity';
import { DisciplinaryCaseStatus, DisciplinaryTrack, EventVisibility } from '../constants/disciplinary.enums';
import { DisciplinaryCaseEventEntity } from '../entities/disciplinary-case-event.entity';
import { DisciplinaryCaseEntity } from '../entities/disciplinary-case.entity';
import { assertTransition } from './disciplinary-workflow';

export const DISCIPLINARY_CASE_AUDIT_ENTITY = 'disciplinary_cases';
export const STATUS_CHANGE_EVENT = 'STATUS_CHANGE';

export interface ApplyTransitionInput {
  caseId: number;
  track: DisciplinaryTrack;
  from: DisciplinaryCaseStatus;
  to: DisciplinaryCaseStatus;
  actorUserId: number | null;
  note?: string | null;
  at?: Date;
}

@Injectable()
export class DisciplinaryWorkflowService {
  assertTransition(
    track: DisciplinaryTrack,
    from: DisciplinaryCaseStatus,
    to: DisciplinaryCaseStatus,
  ): void {
    assertTransition(track, from, to);
  }

  /**
   * Cambia el estado, escribe la bitácora y la auditoría con el mismo EntityManager.
   * El llamador abre la transacción.
   */
  async apply(manager: EntityManager, input: ApplyTransitionInput): Promise<void> {
    assertTransition(input.track, input.from, input.to);
    const at = input.at ?? new Date();

    await manager.update(DisciplinaryCaseEntity, input.caseId, { status: input.to });

    const events = manager.getRepository(DisciplinaryCaseEventEntity);
    await events.save(
      events.create({
        caseId: input.caseId,
        type: STATUS_CHANGE_EVENT,
        actorUserId: input.actorUserId,
        fromStatus: input.from,
        toStatus: input.to,
        payload: { note: input.note ?? null },
        visibility: EventVisibility.PUBLIC,
        createdAt: at,
      }),
    );

    const audit = manager.getRepository(AuditLog);
    await audit.save(
      audit.create({
        actorId: input.actorUserId,
        action: STATUS_CHANGE_EVENT,
        entity: DISCIPLINARY_CASE_AUDIT_ENTITY,
        entityId: String(input.caseId),
        before: { status: input.from },
        after: { status: input.to, note: input.note ?? null },
        createdAt: at,
      }),
    );
  }
}
