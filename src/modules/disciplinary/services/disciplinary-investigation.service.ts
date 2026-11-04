import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { calendarDateInTimeZone } from '../../../common/utils/business-calendar-date.util';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { Role } from '../../../common/enums/role.enum';
import { INSTITUTIONAL_ROLE_ADMIN } from '../../../common/constants/institutional-roles.constant';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { getSeverityRule, InfractionSeverity } from '../constants/infraction-severity.constant';
import {
  CommunicationKind,
  DisciplinaryCaseStatus,
  DisciplinaryTrack,
  EventVisibility,
  ResolutionOutcome,
} from '../constants/disciplinary.enums';
import { SendFormalCommunicationDto } from '../dto/formal-communication.dto';
import { InvestigationMessageDto, InformationResponseDto } from '../dto/investigation.dto';
import { CaseReasonDto } from '../dto/case-reason.dto';
import { ResolveDisciplinaryCaseDto } from '../dto/resolve-disciplinary-case.dto';
import { DisciplinaryCaseEventEntity } from '../entities/disciplinary-case-event.entity';
import { DisciplinaryCaseEntity } from '../entities/disciplinary-case.entity';
import { InfractionTypeEntity } from '../entities/infraction-type.entity';
import { institutionalToday } from '../utils/business-days';
import { DEFENSE_BUSINESS_DAYS, REVOCATION_BUSINESS_DAYS } from './case-opening';
import { buildFormalChargeBody } from './formal-charge';
import { DisciplinaryCommunicationsService } from './disciplinary-communications.service';
import { DisciplinaryActor } from './disciplinary-access.policy';
import {
  COUNSEL_OPINION_EVENT,
  COUNSEL_REQUEST_EVENT,
  INFO_REQUEST_EVENT,
  INFO_RESPONSE_EVENT,
  INVESTIGATION_BUSINESS_DAYS,
  OBSERVATION_EVENT,
  canConductInvestigation,
} from './investigation';
import { FINAL_CASE_STATUSES } from './disciplinary-workflow';

const RESOLUTION_LABELS: Record<ResolutionOutcome, string> = {
  [ResolutionOutcome.DISMISS]: 'Desestima',
  [ResolutionOutcome.MODIFY]: 'Modifica',
  [ResolutionOutcome.UPHOLD]: 'Mantiene',
};
import { DisciplinaryWorkflowService } from './disciplinary-workflow.service';

@Injectable()
export class DisciplinaryInvestigationService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly workflow: DisciplinaryWorkflowService,
    private readonly communications: DisciplinaryCommunicationsService,
  ) {}

  async start(actorUser: AuthenticatedUser, caseId: number) {
    const row = await this.requireCase(caseId);
    const actor = await this.loadActor(actorUser);
    this.assertConductor(actor, row);
    const today = institutionalToday();
    await this.dataSource.transaction(async (manager) => {
      await this.workflow.apply(manager, {
        caseId,
        track: row.track,
        from: row.status,
        to: DisciplinaryCaseStatus.INVESTIGATING,
        actorUserId: actor.userId,
        note: 'Inicio de la investigación',
      });
      await manager.update(DisciplinaryCaseEntity, caseId, {
        stepStartedOn: today,
        stepBusinessDays: INVESTIGATION_BUSINESS_DAYS,
      });
    });
    return {
      id: caseId,
      status: DisciplinaryCaseStatus.INVESTIGATING,
      stepStartedOn: today,
      stepBusinessDays: INVESTIGATION_BUSINESS_DAYS,
    };
  }

  async observe(actorUser: AuthenticatedUser, caseId: number, dto: InvestigationMessageDto) {
    const row = await this.requireCase(caseId);
    const actor = await this.loadActor(actorUser);
    this.assertConductor(actor, row);
    this.assertInvestigating(row);
    const eventId = await this.dataSource.transaction((manager) =>
      this.writeEvent(manager, {
        caseId,
        type: OBSERVATION_EVENT,
        actorUserId: actor.userId,
        payload: { message: dto.message.trim() },
      }),
    );
    return { id: eventId, type: OBSERVATION_EVENT };
  }

  async requestInformation(actorUser: AuthenticatedUser, caseId: number, dto: InvestigationMessageDto) {
    const row = await this.requireCase(caseId);
    const actor = await this.loadActor(actorUser);
    this.assertConductor(actor, row);
    this.assertInvestigating(row);
    const eventId = await this.dataSource.transaction((manager) =>
      this.writeEvent(manager, {
        caseId,
        type: INFO_REQUEST_EVENT,
        actorUserId: actor.userId,
        payload: { message: dto.message.trim(), recipientUserId: row.reporterUserId },
      }),
    );
    return { id: eventId, type: INFO_REQUEST_EVENT, recipientUserId: row.reporterUserId };
  }

  async respond(actorUser: AuthenticatedUser, caseId: number, dto: InformationResponseDto) {
    const row = await this.requireCase(caseId);
    if (actorUser.id !== row.reporterUserId) {
      throw new ForbiddenException('Solo el docente que reportó puede responder esta solicitud');
    }
    this.assertInvestigating(row);
    const eventId = await this.dataSource.transaction(async (manager) => {
      const events = manager.getRepository(DisciplinaryCaseEventEntity);
      const request = await events.findOne({ where: { id: dto.requestEventId, caseId } });
      if (!request || request.type !== INFO_REQUEST_EVENT) {
        throw new NotFoundException({
          code: 'INFO_REQUEST_NOT_FOUND',
          message: 'La solicitud de información no existe',
        });
      }
      const answers = await events.find({ where: { caseId, type: INFO_RESPONSE_EVENT } });
      const answered = answers.some((event) => Number(event.payload?.requestEventId) === dto.requestEventId);
      if (answered) {
        throw new BadRequestException({
          code: 'INFO_ALREADY_ANSWERED',
          message: 'Esa solicitud ya tiene respuesta',
        });
      }
      return this.writeEvent(manager, {
        caseId,
        type: INFO_RESPONSE_EVENT,
        actorUserId: actorUser.id,
        payload: { requestEventId: dto.requestEventId, message: dto.message.trim() },
      });
    });
    return { id: eventId, type: INFO_RESPONSE_EVENT, requestEventId: dto.requestEventId };
  }

  async requestCounsel(actorUser: AuthenticatedUser, caseId: number, dto: InvestigationMessageDto) {
    const row = await this.requireCase(caseId);
    const actor = await this.loadActor(actorUser);
    this.assertConductor(actor, row);
    this.assertCounselStage(row);
    const eventId = await this.dataSource.transaction(async (manager) => {
      if (await this.openCounselRequest(manager, caseId)) {
        throw new BadRequestException({
          code: 'COUNSEL_ALREADY_REQUESTED',
          message: 'Ya hay un criterio de Orientación pendiente',
        });
      }
      return this.writeEvent(manager, {
        caseId,
        type: COUNSEL_REQUEST_EVENT,
        actorUserId: actor.userId,
        payload: { message: dto.message.trim() },
        visibility: EventVisibility.RESERVED,
      });
    });
    return {
      id: eventId,
      type: COUNSEL_REQUEST_EVENT,
      visibility: EventVisibility.RESERVED,
      status: row.status,
    };
  }

  async issueCounsel(actorUser: AuthenticatedUser, caseId: number, dto: InvestigationMessageDto) {
    this.assertReviewer(actorUser);
    const row = await this.requireCase(caseId);
    this.assertCounselStage(row);
    const eventId = await this.dataSource.transaction(async (manager) => {
      const request = await this.openCounselRequest(manager, caseId);
      if (!request) {
        throw new BadRequestException({
          code: 'COUNSEL_NOT_REQUESTED',
          message: 'No hay una solicitud de criterio pendiente',
        });
      }
      return this.writeEvent(manager, {
        caseId,
        type: COUNSEL_OPINION_EVENT,
        actorUserId: actorUser.id,
        payload: { requestEventId: request.id, message: dto.message.trim() },
        visibility: EventVisibility.RESERVED,
      });
    });
    return {
      id: eventId,
      type: COUNSEL_OPINION_EVENT,
      visibility: EventVisibility.RESERVED,
      status: row.status,
    };
  }

  async communicate(actorUser: AuthenticatedUser, caseId: number, dto: SendFormalCommunicationDto) {
    const row = await this.requireCase(caseId);
    const actor = await this.loadActor(actorUser);
    this.assertConductor(actor, row);
    this.assertInvestigating(row);
    const proposedAction = dto.proposedAction.trim();
    if (proposedAction.length < 10) {
      throw new BadRequestException({
        code: 'PROPOSED_ACTION',
        message: 'La acción correctiva propuesta debe tener al menos 10 caracteres',
        field: 'proposedAction',
      });
    }
    const today = institutionalToday();
    const pending = await this.dataSource.transaction(async (manager) => {
      const guardians = await this.communications.loadGuardians(manager, row.studentUserId);
      if (guardians.length === 0) {
        throw new BadRequestException({
          code: 'PHYSICAL_DELIVERY_REQUIRED',
          message: 'El estudiante no tiene un encargado vinculado. Registre la entrega por un medio físico.',
        });
      }
      const infraction = await manager.getRepository(InfractionTypeEntity).findOne({
        where: { id: row.infractionTypeId },
      });
      const rule = getSeverityRule(row.severity);
      const occurredOn = calendarDateInTimeZone(row.occurredAt);
      await this.workflow.apply(manager, {
        caseId,
        track: row.track,
        from: row.status,
        to: DisciplinaryCaseStatus.COMMUNICATED,
        actorUserId: actor.userId,
        note: 'Comunicación formal',
      });
      const issued = await this.communications.issue(manager, {
        caseId,
        kind: CommunicationKind.FORMAL_CHARGE,
        issuerUserId: actor.userId,
        studentUserId: row.studentUserId,
        subject: `Comunicación formal ${row.caseNumber}`,
        body: buildFormalChargeBody({
          caseNumber: row.caseNumber,
          infractionName: infraction?.name ?? 'Falta',
          severityLabel: rule.label,
          deduction: rule.deduction,
          occurredOn,
          place: row.place,
          description: row.description,
          proposedAction,
        }),
      });
      await manager.update(DisciplinaryCaseEntity, caseId, {
        stepStartedOn: today,
        stepBusinessDays: DEFENSE_BUSINESS_DAYS,
        ...(issued.notified ? { notifiedAt: new Date() } : {}),
      });
      return issued;
    });
    await this.communications.dispatch(pending.pending);
    return {
      id: caseId,
      status: DisciplinaryCaseStatus.COMMUNICATED,
      stepStartedOn: today,
      stepBusinessDays: DEFENSE_BUSINESS_DAYS,
      communicationId: pending.communicationId,
    };
  }

  async resolve(actorUser: AuthenticatedUser, caseId: number, dto: ResolveDisciplinaryCaseDto) {
    const row = await this.requireCase(caseId);
    const actor = await this.loadActor(actorUser);
    this.assertConductor(actor, row);
    const reasoning = dto.reasoning.trim();
    if (reasoning.length < 50) {
      throw new BadRequestException({
        code: 'RESOLUTION_REASONING',
        message: 'La fundamentación debe tener al menos 50 caracteres',
        field: 'reasoning',
      });
    }
    const severity = this.resolvedSeverity(row.severity, dto);
    const rule = getSeverityRule(severity);
    const today = institutionalToday();
    const outcomeLabel = RESOLUTION_LABELS[dto.outcome];
    const pending = await this.dataSource.transaction(async (manager) => {
      await this.workflow.apply(manager, {
        caseId,
        track: row.track,
        from: row.status,
        to: DisciplinaryCaseStatus.RESOLVED,
        actorUserId: actor.userId,
        note: outcomeLabel,
      });
      const issued = await this.communications.issue(manager, {
        caseId,
        kind: CommunicationKind.RESOLUTION,
        issuerUserId: actor.userId,
        studentUserId: row.studentUserId,
        subject: `Resolución ${row.caseNumber}`,
        body: [
          `Resolución del expediente ${row.caseNumber}.`,
          `Resultado: ${outcomeLabel}.`,
          dto.outcome === ResolutionOutcome.DISMISS
            ? 'No se propone rebajo.'
            : `Gravedad: ${rule.label}. Rebajo propuesto: ${rule.deduction} puntos.`,
          `Fundamentación: ${reasoning}`,
          'Contra este acto cabe recurso de revocatoria dentro de los 3 días hábiles siguientes. El rebajo se aplica solo cuando el acto quede firme.',
        ].join('\n'),
      });
      await manager.update(DisciplinaryCaseEntity, caseId, {
        resolutionOutcome: dto.outcome,
        resolutionReasoning: reasoning,
        severity,
        stepStartedOn: today,
        stepBusinessDays: REVOCATION_BUSINESS_DAYS,
        ...(issued.notified ? { notifiedAt: new Date() } : {}),
      });
      return issued;
    });
    await this.communications.dispatch(pending.pending);
    return {
      id: caseId,
      status: DisciplinaryCaseStatus.RESOLVED,
      outcome: dto.outcome,
      severity,
      severityLabel: rule.label,
      deduction: dto.outcome === ResolutionOutcome.DISMISS ? 0 : rule.deduction,
      communicationId: pending.communicationId,
      stepStartedOn: today,
      stepBusinessDays: REVOCATION_BUSINESS_DAYS,
    };
  }

  private resolvedSeverity(current: InfractionSeverity, dto: ResolveDisciplinaryCaseDto): InfractionSeverity {
    if (dto.outcome !== ResolutionOutcome.MODIFY) return current;
    if (!dto.severity || dto.severity === current) {
      throw new BadRequestException({
        code: 'RESOLUTION_SEVERITY',
        message: 'Modifica exige una gravedad distinta de la actual',
        field: 'severity',
      });
    }
    return dto.severity;
  }

  async archive(actorUser: AuthenticatedUser, caseId: number, dto: CaseReasonDto) {
    const row = await this.requireCase(caseId);
    const actor = await this.loadActor(actorUser);
    this.assertConductor(actor, row);
    const reason = this.requireReason(dto.reason);
    await this.dataSource.transaction(async (manager) => {
      await this.workflow.apply(manager, {
        caseId,
        track: row.track,
        from: row.status,
        to: DisciplinaryCaseStatus.DISMISSED,
        actorUserId: actor.userId,
        note: reason,
      });
      await manager.update(DisciplinaryCaseEntity, caseId, {
        resolutionOutcome: ResolutionOutcome.DISMISS,
        resolutionReasoning: reason,
        stepBusinessDays: 0,
      });
    });
    return { id: caseId, status: DisciplinaryCaseStatus.DISMISSED, outcome: ResolutionOutcome.DISMISS };
  }

  async annul(actorUser: AuthenticatedUser, caseId: number, dto: CaseReasonDto) {
    this.assertConfigurer(actorUser);
    const row = await this.requireCase(caseId);
    const reason = this.requireReason(dto.reason);
    await this.dataSource.transaction(async (manager) => {
      await this.workflow.apply(manager, {
        caseId,
        track: row.track,
        from: row.status,
        to: DisciplinaryCaseStatus.ANNULLED,
        actorUserId: actorUser.id,
        note: reason,
      });
      await manager.update(DisciplinaryCaseEntity, caseId, {
        annulledAt: new Date(),
        annulReason: reason,
        stepBusinessDays: 0,
      });
    });
    return { id: caseId, status: DisciplinaryCaseStatus.ANNULLED };
  }

  private requireReason(reason: string): string {
    const text = reason.trim();
    if (text.length < 20) {
      throw new BadRequestException({
        code: 'REASON_TOO_SHORT',
        message: 'La justificación debe tener al menos 20 caracteres',
        field: 'reason',
      });
    }
    return text;
  }

  private assertConfigurer(actor: AuthenticatedUser): void {
    const roles = (actor.roles ?? []).map(String);
    const isAdmin = roles.includes(Role.ADMIN) || roles.includes(INSTITUTIONAL_ROLE_ADMIN);
    if (isAdmin || (actor.permissions ?? []).includes(PERMISSIONS.DISCIPLINARY_CONFIGURE)) return;
    throw new ForbiddenException('Solo quien configura disciplina puede anular un expediente');
  }

  private assertConductor(actor: DisciplinaryActor, row: DisciplinaryCaseEntity): void {
    if (!canConductInvestigation(actor, row.responsibleUserId)) {
      throw new ForbiddenException('No puede conducir la investigación de este expediente');
    }
  }

  private assertCounselStage(row: DisciplinaryCaseEntity): void {
    if (row.track !== DisciplinaryTrack.DUE_PROCESS || FINAL_CASE_STATUSES.has(row.status)) {
      throw new BadRequestException({
        code: 'COUNSEL_STAGE',
        message: 'El criterio de Orientación solo aplica a un expediente de debido proceso abierto',
      });
    }
  }

  private assertReviewer(actor: AuthenticatedUser): void {
    const roles = (actor.roles ?? []).map(String);
    const isAdmin = roles.includes(Role.ADMIN) || roles.includes(INSTITUTIONAL_ROLE_ADMIN);
    if (isAdmin || (actor.permissions ?? []).includes(PERMISSIONS.DISCIPLINARY_REVIEW)) return;
    throw new ForbiddenException('Solo Orientación puede emitir el criterio');
  }

  private async openCounselRequest(
    manager: EntityManager,
    caseId: number,
  ): Promise<DisciplinaryCaseEventEntity | null> {
    const events = await manager.getRepository(DisciplinaryCaseEventEntity).find({ where: { caseId } });
    const opinions = new Set(
      events
        .filter((event) => event.type === COUNSEL_OPINION_EVENT)
        .map((event) => Number(event.payload?.requestEventId)),
    );
    return events.find((event) => event.type === COUNSEL_REQUEST_EVENT && !opinions.has(event.id)) ?? null;
  }

  private assertInvestigating(row: DisciplinaryCaseEntity): void {
    if (row.track !== DisciplinaryTrack.DUE_PROCESS || row.status !== DisciplinaryCaseStatus.INVESTIGATING) {
      throw new BadRequestException({
        code: 'INVESTIGATION_STAGE',
        message: 'Esta acción solo está disponible durante la investigación',
      });
    }
  }

  private async requireCase(caseId: number): Promise<DisciplinaryCaseEntity> {
    const row = await this.dataSource.getRepository(DisciplinaryCaseEntity).findOne({ where: { id: caseId } });
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

  private async writeEvent(
    manager: EntityManager,
    input: {
      caseId: number;
      type: string;
      actorUserId: number;
      payload: Record<string, unknown>;
      visibility?: EventVisibility;
    },
  ): Promise<number> {
    const events = manager.getRepository(DisciplinaryCaseEventEntity);
    const saved = await events.save(
      events.create({
        caseId: input.caseId,
        type: input.type,
        actorUserId: input.actorUserId,
        payload: input.payload,
        visibility: input.visibility ?? EventVisibility.PUBLIC,
      }),
    );
    return saved.id;
  }
}
