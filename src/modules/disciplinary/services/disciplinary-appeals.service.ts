import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { INSTITUTIONAL_ROLE_ADMIN } from '../../../common/constants/institutional-roles.constant';
import { Role } from '../../../common/enums/role.enum';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { getSeverityRule, InfractionSeverity } from '../constants/infraction-severity.constant';
import {
  AppealKind,
  AppealOutcome,
  CommunicationKind,
  DisciplinaryCaseStatus,
  DisciplinaryTrack,
  EventVisibility,
} from '../constants/disciplinary.enums';
import { FileAppealDto, FileRevocationDto, ResolveAppealDto } from '../dto/appeal.dto';
import { DisciplinaryAppealEntity } from '../entities/disciplinary-appeal.entity';
import { DisciplinaryCaseEventEntity } from '../entities/disciplinary-case-event.entity';
import { DisciplinaryCaseEntity } from '../entities/disciplinary-case.entity';
import { addBusinessDays, institutionalToday } from '../utils/business-days';
import { REVOCATION_BUSINESS_DAYS } from './case-opening';
import { DisciplinaryActor } from './disciplinary-access.policy';
import { DisciplinaryCommunicationsService } from './disciplinary-communications.service';
import { APPEAL_RESOLUTION_BUSINESS_DAYS, SUBSIDIARY_ELEVATED_EVENT } from './deadline-reconcile';
import { canConductInvestigation } from './investigation';
import { DisciplinaryWorkflowService } from './disciplinary-workflow.service';

const OUTCOME_LABELS: Record<AppealOutcome, string> = {
  [AppealOutcome.REVOKE]: 'Acoge',
  [AppealOutcome.MODIFY]: 'Acoge parcialmente',
  [AppealOutcome.UPHOLD]: 'Rechaza',
};

@Injectable()
export class DisciplinaryAppealsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly workflow: DisciplinaryWorkflowService,
    private readonly communications: DisciplinaryCommunicationsService,
  ) {}

  async fileRevocation(actorUser: AuthenticatedUser, caseId: number, dto: FileRevocationDto) {
    const row = await this.requireCase(caseId);
    await this.assertMayFile(actorUser, row);
    const text = this.requireText(dto.body);
    const subsidiary = Boolean(dto.subsidiary);
    return this.dataSource.transaction(async (manager) => {
      this.assertRevocationWindow(row);
      await this.assertOnTime(manager, row);
      const appeals = manager.getRepository(DisciplinaryAppealEntity);
      if ((await appeals.count({ where: { caseId, kind: AppealKind.REVOCATION } })) > 0) {
        throw new BadRequestException({
          code: 'APPEAL_ALREADY_FILED',
          message: 'Este expediente ya tiene un recurso de revocatoria',
        });
      }
      const saved = await appeals.save(
        appeals.create({
          caseId,
          kind: AppealKind.REVOCATION,
          isSubsidiary: subsidiary,
          body: text,
          filedAt: new Date(),
          filedByUserId: actorUser.id,
        }),
      );
      const today = institutionalToday();
      await this.workflow.apply(manager, {
        caseId,
        track: row.track,
        from: row.status,
        to: DisciplinaryCaseStatus.IN_APPEAL,
        actorUserId: actorUser.id,
        note: subsidiary ? 'Revocatoria con apelación en subsidio' : 'Recurso de revocatoria',
      });
      await manager.update(DisciplinaryCaseEntity, caseId, {
        stepStartedOn: today,
        stepBusinessDays: REVOCATION_BUSINESS_DAYS,
      });
      await this.writeEvent(manager, caseId, actorUser.id, 'REVOCATION_FILED', {
        note: 'Recurso de revocatoria presentado',
        appealId: saved.id,
        subsidiary,
        recipientUserId: row.responsibleUserId,
      });
      return {
        id: saved.id,
        caseId,
        status: DisciplinaryCaseStatus.IN_APPEAL,
        kind: AppealKind.REVOCATION,
        isSubsidiary: subsidiary,
        stepStartedOn: today,
        stepBusinessDays: REVOCATION_BUSINESS_DAYS,
      };
    });
  }

  async fileAppeal(actorUser: AuthenticatedUser, caseId: number, dto: FileAppealDto) {
    const row = await this.requireCase(caseId);
    await this.assertMayFile(actorUser, row);
    const text = this.requireText(dto.body);
    return this.dataSource.transaction(async (manager) => {
      if (row.status !== DisciplinaryCaseStatus.IN_APPEAL) {
        throw new BadRequestException({
          code: 'APPEAL_STAGE',
          message: 'La apelación se interpone después del rechazo de la revocatoria',
        });
      }
      const appeals = manager.getRepository(DisciplinaryAppealEntity);
      const rows = await appeals.find({ where: { caseId } });
      const revocation = rows.find((item) => item.kind === AppealKind.REVOCATION);
      if (!revocation || revocation.outcome !== AppealOutcome.UPHOLD) {
        throw new BadRequestException({
          code: 'APPEAL_STAGE',
          message: 'La apelación se interpone cuando la revocatoria fue rechazada',
        });
      }
      if (revocation.isSubsidiary) {
        throw new BadRequestException({
          code: 'APPEAL_STAGE',
          message: 'La apelación en subsidio se eleva al rechazar la revocatoria',
        });
      }
      if (rows.some((item) => item.kind === AppealKind.APPEAL)) {
        throw new BadRequestException({
          code: 'APPEAL_ALREADY_FILED',
          message: 'Este expediente ya tiene un recurso de apelación',
        });
      }
      await this.assertOnTime(manager, row);
      const saved = await appeals.save(
        appeals.create({
          caseId,
          kind: AppealKind.APPEAL,
          isSubsidiary: false,
          body: text,
          filedAt: new Date(),
          filedByUserId: actorUser.id,
        }),
      );
      const today = institutionalToday();
      await manager.update(DisciplinaryCaseEntity, caseId, {
        stepStartedOn: today,
        stepBusinessDays: APPEAL_RESOLUTION_BUSINESS_DAYS,
      });
      await this.writeEvent(manager, caseId, actorUser.id, 'APPEAL_FILED', {
        note: 'Recurso de apelación presentado',
        appealId: saved.id,
        recipientUserId: row.responsibleUserId,
      });
      return {
        id: saved.id,
        caseId,
        status: DisciplinaryCaseStatus.IN_APPEAL,
        kind: AppealKind.APPEAL,
        stepStartedOn: today,
        stepBusinessDays: APPEAL_RESOLUTION_BUSINESS_DAYS,
      };
    });
  }

  async resolveRevocation(
    actorUser: AuthenticatedUser,
    caseId: number,
    appealId: number,
    dto: ResolveAppealDto,
  ) {
    this.assertResolver(actorUser, PERMISSIONS.DISCIPLINARY_RESOLVE, 'revocatoria');
    if (dto.outcome === AppealOutcome.MODIFY) {
      throw new BadRequestException({
        code: 'APPEAL_OUTCOME',
        message: 'La revocatoria se acoge o se rechaza',
        field: 'outcome',
      });
    }
    const row = await this.requireCase(caseId);
    if (!this.isAdmin(actorUser) && row.responsibleUserId !== actorUser.id) {
      throw new ForbiddenException('La revocatoria la resuelve quien dictó el acto');
    }
    return this.resolve(actorUser, row, appealId, AppealKind.REVOCATION, dto);
  }

  async resolveAppeal(actorUser: AuthenticatedUser, caseId: number, appealId: number, dto: ResolveAppealDto) {
    this.assertResolver(actorUser, PERMISSIONS.DISCIPLINARY_APPEAL, 'apelación');
    return this.resolve(actorUser, await this.requireCase(caseId), appealId, AppealKind.APPEAL, dto);
  }

  private async resolve(
    actorUser: AuthenticatedUser,
    row: DisciplinaryCaseEntity,
    appealId: number,
    kind: AppealKind,
    dto: ResolveAppealDto,
  ) {
    const reasoning = dto.reasoning.trim();
    if (reasoning.length < 20) {
      throw new BadRequestException({
        code: 'APPEAL_REASONING',
        message: 'La fundamentación debe tener al menos 20 caracteres',
        field: 'reasoning',
      });
    }
    const pending = await this.dataSource.transaction(async (manager) => {
      const appeals = manager.getRepository(DisciplinaryAppealEntity);
      const appeal = await appeals.findOne({ where: { id: appealId, caseId: row.id, kind } });
      if (!appeal || appeal.outcome) {
        throw new NotFoundException({
          code: 'APPEAL_NOT_FOUND',
          message: 'El recurso no está pendiente',
        });
      }
      const severity = this.changedSeverity(row.severity, dto);
      await appeals.update(appeal.id, {
        outcome: dto.outcome,
        reasoning,
        newSeverity: severity,
        resolverUserId: actorUser.id,
        resolvedAt: new Date(),
      });
      const today = institutionalToday();
      const next = await this.applyOutcome(manager, row, appeal, dto.outcome, severity, actorUser.id, today);
      const issued = await this.communications.issue(manager, {
        caseId: row.id,
        kind: CommunicationKind.APPEAL_RESOLUTION,
        issuerUserId: actorUser.id,
        studentUserId: row.studentUserId,
        subject: `Resolución de recurso ${row.caseNumber}`,
        body: [
          `Resolución del recurso del expediente ${row.caseNumber}.`,
          `Recurso: ${kind === AppealKind.REVOCATION ? 'revocatoria' : 'apelación'}.`,
          `Resultado: ${OUTCOME_LABELS[dto.outcome]}.`,
          severity
            ? `Gravedad: ${getSeverityRule(severity).label}. Rebajo propuesto: ${getSeverityRule(severity).deduction} puntos.`
            : dto.outcome === AppealOutcome.REVOKE
              ? 'No se aplica rebajo.'
              : `Se mantiene el rebajo propuesto de ${getSeverityRule(row.severity).deduction} puntos.`,
          `Fundamentación: ${reasoning}`,
        ].join('\n'),
      });
      if (issued.notified && !row.notifiedAt) {
        await manager.update(DisciplinaryCaseEntity, row.id, { notifiedAt: new Date() });
      }
      return { ...next, communicationId: issued.communicationId, pending: issued.pending };
    });
    await this.communications.dispatch(pending.pending);
    return {
      id: appealId,
      caseId: row.id,
      status: pending.status,
      outcome: dto.outcome,
      severity: pending.severity,
      deduction: pending.deduction,
      stepBusinessDays: pending.stepBusinessDays,
      communicationId: pending.communicationId,
    };
  }

  private async applyOutcome(
    manager: EntityManager,
    row: DisciplinaryCaseEntity,
    appeal: DisciplinaryAppealEntity,
    outcome: AppealOutcome,
    severity: InfractionSeverity | null,
    actorUserId: number,
    today: string,
  ): Promise<{ status: DisciplinaryCaseStatus; severity: InfractionSeverity; deduction: number; stepBusinessDays: number }> {
    if (appeal.kind === AppealKind.REVOCATION && outcome === AppealOutcome.UPHOLD && appeal.isSubsidiary) {
      await manager.getRepository(DisciplinaryAppealEntity).save(
        manager.getRepository(DisciplinaryAppealEntity).create({
          caseId: row.id,
          kind: AppealKind.APPEAL,
          isSubsidiary: true,
          body: appeal.body,
          filedAt: new Date(),
          filedByUserId: appeal.filedByUserId,
        }),
      );
      await manager.update(DisciplinaryCaseEntity, row.id, {
        stepStartedOn: today,
        stepBusinessDays: APPEAL_RESOLUTION_BUSINESS_DAYS,
      });
      await this.writeEvent(manager, row.id, actorUserId, SUBSIDIARY_ELEVATED_EVENT, {
        note: 'Apelación en subsidio elevada a Dirección',
      });
      return {
        status: DisciplinaryCaseStatus.IN_APPEAL,
        severity: row.severity,
        deduction: getSeverityRule(row.severity).deduction,
        stepBusinessDays: APPEAL_RESOLUTION_BUSINESS_DAYS,
      };
    }

    if (appeal.kind === AppealKind.REVOCATION && outcome === AppealOutcome.UPHOLD) {
      await manager.update(DisciplinaryCaseEntity, row.id, {
        stepStartedOn: today,
        stepBusinessDays: REVOCATION_BUSINESS_DAYS,
      });
      await this.writeEvent(manager, row.id, actorUserId, 'REVOCATION_RESOLVED', {
        note: 'Revocatoria rechazada. Queda abierto el plazo de apelación.',
        outcome,
      });
      return {
        status: DisciplinaryCaseStatus.IN_APPEAL,
        severity: row.severity,
        deduction: getSeverityRule(row.severity).deduction,
        stepBusinessDays: REVOCATION_BUSINESS_DAYS,
      };
    }

    const dismiss = outcome === AppealOutcome.REVOKE;
    const nextStatus = dismiss ? DisciplinaryCaseStatus.DISMISSED : DisciplinaryCaseStatus.FIRM;
    const nextSeverity = severity ?? row.severity;
    await this.workflow.apply(manager, {
      caseId: row.id,
      track: row.track,
      from: row.status,
      to: nextStatus,
      actorUserId,
      note: OUTCOME_LABELS[outcome],
    });
    await manager.update(DisciplinaryCaseEntity, row.id, {
      severity: nextSeverity,
      stepBusinessDays: 0,
      ...(nextStatus === DisciplinaryCaseStatus.FIRM ? { firmAt: new Date() } : {}),
    });
    return {
      status: nextStatus,
      severity: nextSeverity,
      deduction: dismiss ? 0 : getSeverityRule(nextSeverity).deduction,
      stepBusinessDays: 0,
    };
  }

  private changedSeverity(current: InfractionSeverity, dto: ResolveAppealDto): InfractionSeverity | null {
    if (dto.outcome !== AppealOutcome.MODIFY) return null;
    if (!dto.severity || dto.severity === current) {
      throw new BadRequestException({
        code: 'APPEAL_SEVERITY',
        message: 'Acoge parcialmente exige una gravedad distinta de la actual',
        field: 'severity',
      });
    }
    return dto.severity;
  }

  private assertRevocationWindow(row: DisciplinaryCaseEntity): void {
    const direct = row.track === DisciplinaryTrack.DIRECT && row.status === DisciplinaryCaseStatus.NOTIFIED;
    const resolved = row.track === DisciplinaryTrack.DUE_PROCESS && row.status === DisciplinaryCaseStatus.RESOLVED;
    if (!direct && !resolved) {
      throw new BadRequestException({
        code: 'APPEAL_STAGE',
        message: 'La revocatoria se interpone contra la amonestación directa o la resolución',
      });
    }
  }

  private async assertOnTime(manager: EntityManager, row: DisciplinaryCaseEntity): Promise<void> {
    if (row.stepBusinessDays <= 0) {
      throw new BadRequestException({
        code: 'APPEAL_DEADLINE',
        message: 'El recurso es extemporáneo',
      });
    }
    const holidays = (await manager.query('SELECT day FROM non_working_days')) as Array<{ day: string | Date }>;
    const nonWorkingDays = new Set(holidays.map((holiday) => String(holiday.day).slice(0, 10)));
    const dueOn = addBusinessDays(String(row.stepStartedOn).slice(0, 10), row.stepBusinessDays, nonWorkingDays);
    if (institutionalToday() > dueOn) {
      throw new BadRequestException({
        code: 'APPEAL_DEADLINE',
        message: 'El recurso es extemporáneo',
      });
    }
  }

  private async assertMayFile(actorUser: AuthenticatedUser, row: DisciplinaryCaseEntity): Promise<void> {
    if (canConductInvestigation(this.asActor(actorUser), row.responsibleUserId)) return;
    const linked = await this.dataSource.query(
      `SELECT id_users_student AS studentUserId
       FROM guardian_student_links
       WHERE id_users_guardian = ? AND id_users_student = ?
       LIMIT 1`,
      [actorUser.id, row.studentUserId],
    );
    if (!linked.length) {
      throw new ForbiddenException('Solo el encargado vinculado o el responsable puede interponer el recurso');
    }
  }

  private assertResolver(actor: AuthenticatedUser, permission: string, resource: string): void {
    if (this.isAdmin(actor) || (actor.permissions ?? []).includes(permission)) return;
    throw new ForbiddenException(`No puede resolver la ${resource}`);
  }

  private isAdmin(actor: AuthenticatedUser): boolean {
    const roles = (actor.roles ?? []).map(String);
    return roles.includes(Role.ADMIN) || roles.includes(INSTITUTIONAL_ROLE_ADMIN);
  }

  private asActor(actor: AuthenticatedUser): DisciplinaryActor {
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

  private requireText(body: string): string {
    const text = body.trim();
    if (text.length < 10) {
      throw new BadRequestException({
        code: 'APPEAL_BODY',
        message: 'El recurso debe tener al menos 10 caracteres',
        field: 'body',
      });
    }
    return text;
  }

  private async writeEvent(
    manager: EntityManager,
    caseId: number,
    actorUserId: number,
    type: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const events = manager.getRepository(DisciplinaryCaseEventEntity);
    await events.save(
      events.create({
        caseId,
        type,
        actorUserId,
        payload,
        visibility: EventVisibility.PUBLIC,
      }),
    );
  }

  private async requireCase(caseId: number): Promise<DisciplinaryCaseEntity> {
    const row = await this.dataSource.getRepository(DisciplinaryCaseEntity).findOne({ where: { id: caseId } });
    if (!row) {
      throw new NotFoundException({ code: 'CASE_NOT_FOUND', message: 'El expediente no existe' });
    }
    return row;
  }
}
