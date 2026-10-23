import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { AuditLog } from '../../administrative/users/entities/audit-log.entity';
import { calendarDateInTimeZone } from '../../../common/utils/business-calendar-date.util';
import {
  DisciplinaryCaseStatus,
  EventVisibility,
} from '../constants/disciplinary.enums';
import { DisciplinaryAppealEntity } from '../entities/disciplinary-appeal.entity';
import { DisciplinaryCaseEventEntity } from '../entities/disciplinary-case-event.entity';
import { DisciplinaryCaseEntity } from '../entities/disciplinary-case.entity';
import { DisciplinaryDefenseEntity } from '../entities/disciplinary-defense.entity';
import { NonWorkingDayEntity } from '../entities/non-working-day.entity';
import { institutionalToday } from '../utils/business-days';
import {
  DISCIPLINARY_CASE_AUDIT_ENTITY,
} from './disciplinary-workflow.service';
import { DisciplinaryFollowUpService } from './disciplinary-follow-up.service';
import { DisciplinaryWorkflowService } from './disciplinary-workflow.service';
import {
  DeadlinePlan,
  DeadlineSnapshot,
  isSubsidiaryAwaitingElevation,
  planDeadline,
  SUBSIDIARY_ELEVATED_EVENT,
} from './deadline-reconcile';

const OPEN_FOR_DEADLINE: DisciplinaryCaseStatus[] = [
  DisciplinaryCaseStatus.COMMUNICATED,
  DisciplinaryCaseStatus.RESOLVED,
  DisciplinaryCaseStatus.NOTIFIED,
  DisciplinaryCaseStatus.IN_APPEAL,
];

const HOUR_MS = 60 * 60 * 1000;

export function deadlineReconcileEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (env.DISCIPLINARY_RECONCILE ?? 'true').trim().toLowerCase() !== 'false';
}

/** Mediodía de Costa Rica (UTC-6) del día de vencimiento. */
export function dueInstant(isoDate: string): Date {
  return new Date(`${isoDate}T18:00:00.000Z`);
}

@Injectable()
export class DisciplinaryDeadlineService implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly dataSource: DataSource,
    private readonly workflow: DisciplinaryWorkflowService,
    @InjectRepository(DisciplinaryCaseEntity)
    private readonly cases: Repository<DisciplinaryCaseEntity>,
    @InjectRepository(DisciplinaryDefenseEntity)
    private readonly defenses: Repository<DisciplinaryDefenseEntity>,
    @InjectRepository(DisciplinaryAppealEntity)
    private readonly appeals: Repository<DisciplinaryAppealEntity>,
    @InjectRepository(DisciplinaryCaseEventEntity)
    private readonly events: Repository<DisciplinaryCaseEventEntity>,
    @InjectRepository(NonWorkingDayEntity)
    private readonly nonWorkingDays: Repository<NonWorkingDayEntity>,
    private readonly followUps: DisciplinaryFollowUpService,
  ) {}

  onModuleInit(): void {
    if (!deadlineReconcileEnabled() || process.env.NODE_ENV === 'test') return;
    void this.reconcileDeadlines();
    this.timer = setInterval(() => {
      void this.reconcileDeadlines();
    }, HOUR_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async reconcileDeadlines(today: string = institutionalToday()): Promise<number> {
    const holidays = new Set(
      (await this.nonWorkingDays.find()).map((day) => this.asIso(day.day)),
    );
    const rows = await this.cases.find({ where: { status: In(OPEN_FOR_DEADLINE) } });
    let changed = 0;
    for (const row of rows) {
      const snapshot = await this.snapshot(row);
      const plan = planDeadline(snapshot, today, holidays);
      if (!plan) continue;
      await this.dataSource.transaction(async (manager) => {
        await this.applyPlan(manager, row, plan);
      });
      changed += 1;
    }
    await this.followUps.remindDue(today);
    return changed;
  }

  async applyPlan(
    manager: EntityManager,
    row: Pick<DisciplinaryCaseEntity, 'id' | 'track' | 'status'>,
    plan: DeadlinePlan,
  ): Promise<void> {
    const at = dueInstant(plan.effectiveOn);
    if (plan.type === 'ELEVATE_SUBSIDIARY') {
      await manager.update(DisciplinaryCaseEntity, row.id, {
        stepStartedOn: plan.effectiveOn,
        stepBusinessDays: plan.businessDays,
      });
      const events = manager.getRepository(DisciplinaryCaseEventEntity);
      await events.save(
        events.create({
          caseId: row.id,
          type: SUBSIDIARY_ELEVATED_EVENT,
          actorUserId: null,
          fromStatus: row.status,
          toStatus: row.status,
          payload: { note: 'Apelación en subsidio elevada a Dirección' },
          visibility: EventVisibility.PUBLIC,
          createdAt: at,
        }),
      );
      const audit = manager.getRepository(AuditLog);
      await audit.save(
        audit.create({
          actorId: null,
          action: SUBSIDIARY_ELEVATED_EVENT,
          entity: DISCIPLINARY_CASE_AUDIT_ENTITY,
          entityId: String(row.id),
          before: { status: row.status },
          after: { stepBusinessDays: plan.businessDays, elevatedOn: plan.effectiveOn },
          createdAt: at,
        }),
      );
      return;
    }

    await this.workflow.apply(manager, {
      caseId: row.id,
      track: row.track,
      from: row.status,
      to: plan.to,
      actorUserId: null,
      note: plan.note,
      at,
    });
    const extra: Partial<DisciplinaryCaseEntity> = {};
    if (plan.firm) extra.firmAt = at;
    if (plan.stepStartedOn) extra.stepStartedOn = plan.stepStartedOn;
    if (plan.stepBusinessDays != null) extra.stepBusinessDays = plan.stepBusinessDays;
    if (Object.keys(extra).length) {
      await manager.update(DisciplinaryCaseEntity, row.id, extra);
    }
  }

  private async snapshot(row: DisciplinaryCaseEntity): Promise<DeadlineSnapshot> {
    const [defenseCount, appeals, elevated] = await Promise.all([
      this.defenses.count({ where: { caseId: row.id } }),
      this.appeals.find({ where: { caseId: row.id } }),
      this.events.count({ where: { caseId: row.id, type: SUBSIDIARY_ELEVATED_EVENT } }),
    ]);
    const facts = appeals.map((appeal) => ({
      kind: appeal.kind,
      isSubsidiary: appeal.isSubsidiary,
      outcome: appeal.outcome,
      resolvedOn: appeal.resolvedAt ? calendarDateInTimeZone(appeal.resolvedAt) : null,
    }));
    const subsidiary = isSubsidiaryAwaitingElevation(facts, elevated > 0);
    return {
      track: row.track,
      status: row.status,
      stepStartedOn: this.asIso(row.stepStartedOn),
      stepBusinessDays: row.stepBusinessDays,
      resolutionOutcome: row.resolutionOutcome,
      defenseFiled: defenseCount > 0,
      appealOpen: facts.some((appeal) => appeal.outcome == null),
      subsidiaryAwaitingElevation: subsidiary.pending,
      revocationRejectedOn: subsidiary.rejectedOn,
    };
  }

  private asIso(value: string | Date): string {
    if (value instanceof Date) return calendarDateInTimeZone(value);
    return String(value).slice(0, 10);
  }
}
