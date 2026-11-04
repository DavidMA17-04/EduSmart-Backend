import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Role } from '../../../common/enums/role.enum';
import { INSTITUTIONAL_ROLE_ADMIN } from '../../../common/constants/institutional-roles.constant';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { FollowUpKind, FollowUpOutcome, EventVisibility } from '../constants/disciplinary.enums';
import { CloseFollowUpDto, CreateFollowUpDto } from '../dto/follow-up.dto';
import { DisciplinaryCaseEventEntity } from '../entities/disciplinary-case-event.entity';
import { DisciplinaryCaseEntity } from '../entities/disciplinary-case.entity';
import { DisciplinaryFollowUpEntity } from '../entities/disciplinary-follow-up.entity';
import { institutionalToday } from '../utils/business-days';
import { DisciplinaryActor } from './disciplinary-access.policy';
import {
  FOLLOW_UP_EVENT,
  FOLLOW_UP_OUTCOME_EVENT,
  FOLLOW_UP_REMINDER_EVENT,
  canRegisterFollowUp,
  pendingReminders,
} from './follow-up';

function safeJson(value: string): { followUpId?: number } | null {
  try {
    return JSON.parse(value) as { followUpId?: number };
  } catch {
    return null;
  }
}

@Injectable()
export class DisciplinaryFollowUpService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(DisciplinaryFollowUpEntity)
    private readonly followUps: Repository<DisciplinaryFollowUpEntity>,
    @InjectRepository(DisciplinaryCaseEntity)
    private readonly cases: Repository<DisciplinaryCaseEntity>,
  ) {}

  async create(actorUser: AuthenticatedUser, caseId: number, dto: CreateFollowUpDto) {
    const row = await this.requireCase(caseId);
    const actor = await this.loadActor(actorUser);
    if (!canRegisterFollowUp(actor, row.responsibleUserId)) {
      throw new ForbiddenException('No puede registrar el seguimiento de este expediente');
    }
    const today = institutionalToday();
    if (dto.followedOn > today) {
      throw new BadRequestException({
        code: 'FOLLOW_UP_DATE',
        message: 'La fecha del seguimiento no puede ser futura',
        field: 'followedOn',
      });
    }
    const reviewOn = dto.reviewOn ?? null;
    if (dto.kind === FollowUpKind.COMMITMENT && !reviewOn) {
      throw new BadRequestException({
        code: 'FOLLOW_UP_REVIEW',
        message: 'Un compromiso necesita fecha de revisión',
        field: 'reviewOn',
      });
    }
    if (reviewOn && reviewOn < dto.followedOn) {
      throw new BadRequestException({
        code: 'FOLLOW_UP_REVIEW',
        message: 'La revisión no puede ser anterior al seguimiento',
        field: 'reviewOn',
      });
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(DisciplinaryFollowUpEntity);
      const created = await repo.save(
        repo.create({
          caseId,
          kind: dto.kind,
          followedOn: dto.followedOn,
          description: dto.description.trim(),
          participants: dto.participants?.trim() || null,
          reviewOn,
          outcome: FollowUpOutcome.PENDING,
          authorUserId: actor.userId,
        }),
      );
      const events = manager.getRepository(DisciplinaryCaseEventEntity);
      await events.save(
        events.create({
          caseId,
          type: FOLLOW_UP_EVENT,
          actorUserId: actor.userId,
          payload: { followUpId: created.id, kind: created.kind, followedOn: created.followedOn },
          visibility: EventVisibility.PUBLIC,
        }),
      );
      return created;
    });
    return this.toView(saved);
  }

  async close(actorUser: AuthenticatedUser, caseId: number, followUpId: number, dto: CloseFollowUpDto) {
    const row = await this.requireCase(caseId);
    const actor = await this.loadActor(actorUser);
    if (!canRegisterFollowUp(actor, row.responsibleUserId)) {
      throw new ForbiddenException('No puede registrar el seguimiento de este expediente');
    }
    const followUp = await this.followUps.findOne({ where: { id: followUpId, caseId } });
    if (!followUp) {
      throw new NotFoundException({ code: 'FOLLOW_UP_NOT_FOUND', message: 'El seguimiento no existe' });
    }
    if (followUp.kind !== FollowUpKind.COMMITMENT) {
      throw new BadRequestException({
        code: 'FOLLOW_UP_NOT_COMMITMENT',
        message: 'Solo un compromiso se marca como cumplido o incumplido',
      });
    }
    if (followUp.outcome !== FollowUpOutcome.PENDING) {
      throw new BadRequestException({
        code: 'FOLLOW_UP_ALREADY_CLOSED',
        message: 'El compromiso ya tiene un resultado',
      });
    }
    const note = dto.note.trim();
    await this.dataSource.transaction(async (manager) => {
      await manager.update(DisciplinaryFollowUpEntity, followUp.id, {
        outcome: dto.outcome,
        outcomeNote: note,
      });
      const events = manager.getRepository(DisciplinaryCaseEventEntity);
      await events.save(
        events.create({
          caseId,
          type: FOLLOW_UP_OUTCOME_EVENT,
          actorUserId: actor.userId,
          payload: { followUpId: followUp.id, outcome: dto.outcome, note },
          visibility: EventVisibility.PUBLIC,
        }),
      );
    });
    return {
      ...this.toView(followUp),
      description: followUp.description,
      outcome: dto.outcome,
      outcomeNote: note,
    };
  }

  async remindDue(today: string = institutionalToday()): Promise<number> {
    const rows = (await this.dataSource.query(
      `
      SELECT f.id_disciplinary_follow_ups AS id,
             f.id_disciplinary_cases AS caseId,
             f.review_on AS reviewOn,
             f.id_users_author AS authorUserId,
             c.id_users_responsible AS responsibleUserId
      FROM disciplinary_follow_ups f
      INNER JOIN disciplinary_cases c ON c.id_disciplinary_cases = f.id_disciplinary_cases
      WHERE f.kind = ?
        AND f.outcome = ?
        AND f.review_on IS NOT NULL
      `,
      [FollowUpKind.COMMITMENT, FollowUpOutcome.PENDING],
    )) as Array<Record<string, unknown>>;
    const reminded = (await this.dataSource.query(
      `SELECT payload FROM disciplinary_case_events WHERE type = ?`,
      [FOLLOW_UP_REMINDER_EVENT],
    )) as Array<{ payload: { followUpId?: number } | string | null }>;
    const remindedIds = new Set(
      reminded
        .map((row) => {
          const payload = typeof row.payload === 'string' ? safeJson(row.payload) : row.payload;
          return Number(payload?.followUpId);
        })
        .filter((id) => Number.isInteger(id)),
    );
    const due = pendingReminders(
      rows.map((row) => ({
        id: Number(row.id),
        caseId: Number(row.caseId),
        reviewOn: String(row.reviewOn).slice(0, 10),
        responsibleUserId: row.responsibleUserId == null ? null : Number(row.responsibleUserId),
        authorUserId: Number(row.authorUserId),
      })),
      today,
      remindedIds,
    );
    for (const item of due) {
      const events = this.dataSource.getRepository(DisciplinaryCaseEventEntity);
      await events.save(
        events.create({
          caseId: item.caseId,
          type: FOLLOW_UP_REMINDER_EVENT,
          actorUserId: item.responsibleUserId ?? item.authorUserId,
          payload: { followUpId: item.id, reviewOn: item.reviewOn },
          visibility: EventVisibility.PUBLIC,
        }),
      );
    }
    return due.length;
  }

  private async requireCase(caseId: number): Promise<DisciplinaryCaseEntity> {
    const row = await this.cases.findOne({ where: { id: caseId } });
    if (!row) {
      throw new NotFoundException({ code: 'CASE_NOT_FOUND', message: 'El expediente no existe' });
    }
    return row;
  }

  private async loadActor(actor: AuthenticatedUser): Promise<DisciplinaryActor> {
    const roleNames = (actor.roles ?? []).map(String);
    if (roleNames.includes(Role.ADMIN) && !roleNames.includes(INSTITUTIONAL_ROLE_ADMIN)) {
      roleNames.push(INSTITUTIONAL_ROLE_ADMIN);
    }
    return {
      userId: actor.id,
      permissions: actor.permissions ?? [],
      roleNames,
      guideGroupIds: [],
      linkedStudentIds: [],
    };
  }

  private toView(row: DisciplinaryFollowUpEntity) {
    return {
      id: row.id,
      caseId: row.caseId,
      kind: row.kind,
      followedOn: String(row.followedOn).slice(0, 10),
      description: row.description,
      participants: row.participants,
      reviewOn: row.reviewOn ? String(row.reviewOn).slice(0, 10) : null,
      outcome: row.outcome,
      outcomeNote: row.outcomeNote,
      authorUserId: row.authorUserId,
    };
  }
}
