import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Role } from '../../../common/enums/role.enum';
import { INSTITUTIONAL_ROLE_ADMIN } from '../../../common/constants/institutional-roles.constant';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { AppealKind, AppealOutcome, CommunicationKind, DisciplinaryCaseStatus, DisciplinaryTrack, EventVisibility } from '../constants/disciplinary.enums';
import { InfractionSeverity } from '../constants/infraction-severity.constant';
import { ListDisciplinaryAppealsQueryDto, AppealOutcomeFilter } from '../dto/list-disciplinary-appeals-query.dto';
import { NonWorkingDayEntity } from '../entities/non-working-day.entity';
import { institutionalToday } from '../utils/business-days';
import { actorCanListCases, caseScopeClause, DeadlineIndicator, stepDeadline } from './case-read';
import { DeductionState } from './conduct-grade';
import { canViewAllCases, canViewCase, DisciplinaryActor, visibleEvents, visibleWitnesses } from './disciplinary-access.policy';
import { AppealDashboard, buildAppealDashboard } from './appeal-reports';
import { DisciplinaryDeadlineService } from './disciplinary-deadline.service';
import { appealDeduction, AppealTimelineEntry, buildAppealTimeline } from './appeal-tracking';
import {
  AppealFact,
  actorCanReviewQueue,
  actorHasAdminPower,
  canFileDisciplinaryRemedy,
  canReviewPendingAppeal,
  eligibleRemedyKind,
} from './appeal-query';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';

const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const APPEAL_FROM = `
  FROM disciplinary_appeals a
  INNER JOIN disciplinary_cases c ON c.id_disciplinary_cases = a.id_disciplinary_cases
  INNER JOIN users u ON u.id_users = c.id_users_student
  INNER JOIN \`groups\` g ON g.id_groups = c.id_groups
  LEFT JOIN sections s ON s.id_sections = g.id_sections
`;

const CASE_FROM = `
  FROM disciplinary_cases c
  INNER JOIN users u ON u.id_users = c.id_users_student
  INNER JOIN \`groups\` g ON g.id_groups = c.id_groups
  LEFT JOIN sections s ON s.id_sections = g.id_sections
`;

export interface DisciplinaryAppealListItem {
  id: number;
  caseId: number;
  caseNumber: string;
  kind: AppealKind;
  isSubsidiary: boolean;
  outcome: AppealOutcome | null;
  filedAt: string | null;
  filedByUserId: number;
  resolvedAt: string | null;
  resolverUserId: number | null;
  caseStatus: DisciplinaryCaseStatus;
  track: DisciplinaryTrack;
  studentUserId: number;
  studentFullName: string;
  sectionLabel: string | null;
  groupId: number;
  responsibleUserId: number | null;
  dueOn: string | null;
  deadline: DeadlineIndicator;
  stepBusinessDays: number;
  caseSeverity: InfractionSeverity | string;
  deduction: number;
  deductionState: DeductionState;
  deductionLabel: string;
}

export interface AppealResolutionNotice {
  communicationId: number;
  issuedAt: string;
  notificationId: number | null;
  readAt: string | null;
  canConfirm: boolean;
}

export interface DisciplinaryAppealTracking extends DisciplinaryAppealListItem {
  body: string;
  reasoning: string | null;
  witnesses: string | null;
  timeline: AppealTimelineEntry[];
  resolutionNotice: AppealResolutionNotice | null;
}

export interface DisciplinaryAppealReviewItem extends DisciplinaryAppealListItem {
  body: string;
  caseSeverity: InfractionSeverity | string;
}

export interface EligibleDisciplinaryCase {
  caseId: number;
  caseNumber: string;
  studentUserId: number;
  studentFullName: string;
  caseStatus: DisciplinaryCaseStatus;
  track: DisciplinaryTrack;
  kind: AppealKind;
  dueOn: string | null;
  deadline: DeadlineIndicator;
  stepBusinessDays: number;
}

@Injectable()
export class DisciplinaryAppealQueryService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(NonWorkingDayEntity)
    private readonly nonWorkingDays: Repository<NonWorkingDayEntity>,
    private readonly deadlines: DisciplinaryDeadlineService,
  ) {}

  async list(actorUser: AuthenticatedUser, query: ListDisciplinaryAppealsQueryDto) {
    await this.deadlines.reconcileDeadlines();
    const actor = await this.loadActor(actorUser);
    if (!actorCanListCases(actor)) {
      throw new ForbiddenException('No tiene acceso a los recursos disciplinarios');
    }

    const holidays = await this.holidaySet();
    const today = institutionalToday();
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? PAGE_SIZE, MAX_PAGE_SIZE);
    const { whereSql, params } = this.listFilters(query, actor);

    const rows = (await this.dataSource.query(
      `
      SELECT a.id_disciplinary_appeals AS id,
             a.id_disciplinary_cases AS caseId,
             a.kind AS kind,
             a.is_subsidiary AS isSubsidiary,
             a.outcome AS outcome,
             a.filed_at AS filedAt,
             a.id_users_filed_by AS filedByUserId,
             a.resolved_at AS resolvedAt,
             a.id_users_resolver AS resolverUserId,
             c.case_number AS caseNumber,
             c.status AS caseStatus,
             c.track AS track,
             c.severity AS caseSeverity,
             c.id_users_student AS studentUserId,
             u.name AS name,
             u.first_lastname AS firstLastname,
             u.second_lastname AS secondLastname,
             c.id_groups AS groupId,
             g.name AS groupName,
             s.grade_level AS gradeLevel,
             c.id_users_responsible AS responsibleUserId,
             c.step_started_on AS stepStartedOn,
             c.step_business_days AS stepBusinessDays
      ${APPEAL_FROM}
      ${whereSql}
      ORDER BY a.filed_at DESC, a.id_disciplinary_appeals DESC
      `,
      params,
    )) as Array<Record<string, unknown>>;

    const viewed = rows.map((row) => this.toListItem(row, today, holidays));
    const matched = query.deadline
      ? viewed.filter((item) => item.deadline === query.deadline)
      : viewed;
    const pageRows = matched.slice((page - 1) * pageSize, page * pageSize);
    return {
      data: pageRows,
      total: matched.length,
      page,
      pageSize,
    };
  }

  async dashboard(
    actorUser: AuthenticatedUser,
    query: ListDisciplinaryAppealsQueryDto,
  ): Promise<AppealDashboard> {
    const actor = await this.loadActor(actorUser);
    if (!canViewAllCases(actor)) {
      throw new ForbiddenException('No tiene acceso al tablero de recursos disciplinarios');
    }
    const listed = await this.listAll(actorUser, query);
    return buildAppealDashboard(listed);
  }

  async listAll(actorUser: AuthenticatedUser, query: ListDisciplinaryAppealsQueryDto) {
    const first = await this.list(actorUser, { ...query, page: 1, pageSize: MAX_PAGE_SIZE });
    const rows = [...first.data];
    const pages = Math.max(1, Math.ceil(first.total / first.pageSize));
    for (let page = 2; page <= pages; page += 1) {
      const next = await this.list(actorUser, { ...query, page, pageSize: MAX_PAGE_SIZE });
      rows.push(...next.data);
    }
    return rows;
  }

  async listEligible(actorUser: AuthenticatedUser): Promise<{ data: EligibleDisciplinaryCase[]; total: number }> {
    await this.deadlines.reconcileDeadlines();
    const actor = await this.loadActor(actorUser);
    if (!actorCanListCases(actor) && actor.linkedStudentIds.length === 0) {
      throw new ForbiddenException('No tiene acceso a interponer recursos');
    }

    const holidays = await this.holidaySet();
    const today = institutionalToday();
    const { whereSql, params } = this.eligibleCaseFilters(actor);
    const rows = (await this.dataSource.query(
      `
      SELECT c.id_disciplinary_cases AS caseId,
             c.case_number AS caseNumber,
             c.status AS caseStatus,
             c.track AS track,
             c.id_users_student AS studentUserId,
             u.name AS name,
             u.first_lastname AS firstLastname,
             u.second_lastname AS secondLastname,
             c.id_users_responsible AS responsibleUserId,
             c.step_started_on AS stepStartedOn,
             c.step_business_days AS stepBusinessDays
      ${CASE_FROM}
      ${whereSql}
      ORDER BY c.updated_at DESC, c.id_disciplinary_cases DESC
      `,
      params,
    )) as Array<Record<string, unknown>>;

    const caseIds = rows.map((row) => Number(row.caseId));
    const appealsByCase = await this.loadAppealFacts(caseIds);
    const data: EligibleDisciplinaryCase[] = [];

    for (const row of rows) {
      const studentUserId = Number(row.studentUserId);
      const responsibleUserId = row.responsibleUserId == null ? null : Number(row.responsibleUserId);
      if (!canFileDisciplinaryRemedy(actor, studentUserId, responsibleUserId)) continue;

      const kind = eligibleRemedyKind(
        {
          track: row.track as DisciplinaryTrack,
          status: row.caseStatus as DisciplinaryCaseStatus,
          stepStartedOn: asIsoDay(row.stepStartedOn),
          stepBusinessDays: Number(row.stepBusinessDays),
          appeals: appealsByCase.get(Number(row.caseId)) ?? [],
        },
        today,
        holidays,
      );
      if (!kind) continue;

      const deadline = stepDeadline(
        asIsoDay(row.stepStartedOn),
        Number(row.stepBusinessDays),
        today,
        holidays,
      );
      data.push({
        caseId: Number(row.caseId),
        caseNumber: String(row.caseNumber),
        studentUserId,
        studentFullName: [row.name, row.firstLastname, row.secondLastname].filter(Boolean).join(' '),
        caseStatus: row.caseStatus as DisciplinaryCaseStatus,
        track: row.track as DisciplinaryTrack,
        kind,
        dueOn: deadline.dueOn,
        deadline: deadline.deadline,
        stepBusinessDays: Number(row.stepBusinessDays),
      });
    }

    return { data, total: data.length };
  }

  async listReviewable(actorUser: AuthenticatedUser, query: ListDisciplinaryAppealsQueryDto) {
    await this.deadlines.reconcileDeadlines();
    const actor = await this.loadActor(actorUser);
    if (!actorCanReviewQueue(actor)) {
      throw new ForbiddenException('No tiene autorización para revisar recursos');
    }

    const holidays = await this.holidaySet();
    const today = institutionalToday();
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? PAGE_SIZE, MAX_PAGE_SIZE);
    const { whereSql, params } = this.reviewFilters(query, actor);

    const rows = (await this.dataSource.query(
      `
      SELECT a.id_disciplinary_appeals AS id,
             a.id_disciplinary_cases AS caseId,
             a.kind AS kind,
             a.is_subsidiary AS isSubsidiary,
             a.outcome AS outcome,
             a.body AS body,
             a.filed_at AS filedAt,
             a.id_users_filed_by AS filedByUserId,
             a.resolved_at AS resolvedAt,
             a.id_users_resolver AS resolverUserId,
             c.case_number AS caseNumber,
             c.status AS caseStatus,
             c.track AS track,
             c.severity AS caseSeverity,
             c.id_users_student AS studentUserId,
             u.name AS name,
             u.first_lastname AS firstLastname,
             u.second_lastname AS secondLastname,
             c.id_groups AS groupId,
             g.name AS groupName,
             s.grade_level AS gradeLevel,
             c.id_users_responsible AS responsibleUserId,
             c.step_started_on AS stepStartedOn,
             c.step_business_days AS stepBusinessDays
      ${APPEAL_FROM}
      ${whereSql}
      ORDER BY a.filed_at DESC, a.id_disciplinary_appeals DESC
      `,
      params,
    )) as Array<Record<string, unknown>>;

    const viewed = rows
      .map((row) => this.toReviewItem(row, today, holidays))
      .filter((item) =>
        canReviewPendingAppeal(actor, item.kind, item.outcome, item.responsibleUserId),
      );
    const matched = query.deadline
      ? viewed.filter((item) => item.deadline === query.deadline)
      : viewed;
    const pageRows = matched.slice((page - 1) * pageSize, page * pageSize);
    return {
      data: pageRows,
      total: matched.length,
      page,
      pageSize,
    };
  }

  async getReviewable(actorUser: AuthenticatedUser, appealId: number): Promise<DisciplinaryAppealReviewItem> {
    await this.deadlines.reconcileDeadlines();
    const actor = await this.loadActor(actorUser);
    if (!actorCanReviewQueue(actor)) {
      throw new ForbiddenException('No tiene autorización para revisar recursos');
    }

    const holidays = await this.holidaySet();
    const today = institutionalToday();
    const rows = (await this.dataSource.query(
      `
      SELECT a.id_disciplinary_appeals AS id,
             a.id_disciplinary_cases AS caseId,
             a.kind AS kind,
             a.is_subsidiary AS isSubsidiary,
             a.outcome AS outcome,
             a.body AS body,
             a.filed_at AS filedAt,
             a.id_users_filed_by AS filedByUserId,
             a.resolved_at AS resolvedAt,
             a.id_users_resolver AS resolverUserId,
             c.case_number AS caseNumber,
             c.status AS caseStatus,
             c.track AS track,
             c.severity AS caseSeverity,
             c.id_users_student AS studentUserId,
             u.name AS name,
             u.first_lastname AS firstLastname,
             u.second_lastname AS secondLastname,
             c.id_groups AS groupId,
             g.name AS groupName,
             s.grade_level AS gradeLevel,
             c.id_users_responsible AS responsibleUserId,
             c.step_started_on AS stepStartedOn,
             c.step_business_days AS stepBusinessDays
      ${APPEAL_FROM}
      WHERE a.id_disciplinary_appeals = ?
      LIMIT 1
      `,
      [appealId],
    )) as Array<Record<string, unknown>>;

    const row = rows[0];
    if (!row) {
      throw new ForbiddenException('No tiene autorización para revisar este recurso');
    }
    const item = this.toReviewItem(row, today, holidays);
    if (!canReviewPendingAppeal(actor, item.kind, item.outcome, item.responsibleUserId)) {
      throw new ForbiddenException('No tiene autorización para revisar este recurso');
    }
    return item;
  }

  async getTracking(actorUser: AuthenticatedUser, appealId: number): Promise<DisciplinaryAppealTracking> {
    await this.deadlines.reconcileDeadlines();
    const actor = await this.loadActor(actorUser);
    if (!actorCanListCases(actor)) {
      throw new ForbiddenException('No tiene acceso a los recursos disciplinarios');
    }

    const holidays = await this.holidaySet();
    const today = institutionalToday();
    const rows = (await this.dataSource.query(
      `
      SELECT a.id_disciplinary_appeals AS id,
             a.id_disciplinary_cases AS caseId,
             a.kind AS kind,
             a.is_subsidiary AS isSubsidiary,
             a.outcome AS outcome,
             a.body AS body,
             a.reasoning AS reasoning,
             a.filed_at AS filedAt,
             a.id_users_filed_by AS filedByUserId,
             a.resolved_at AS resolvedAt,
             a.id_users_resolver AS resolverUserId,
             c.case_number AS caseNumber,
             c.status AS caseStatus,
             c.track AS track,
             c.severity AS caseSeverity,
             c.witnesses AS witnesses,
             c.id_users_student AS studentUserId,
             c.id_users_reporter AS reporterUserId,
             u.name AS name,
             u.first_lastname AS firstLastname,
             u.second_lastname AS secondLastname,
             c.id_groups AS groupId,
             g.name AS groupName,
             s.grade_level AS gradeLevel,
             c.id_users_responsible AS responsibleUserId,
             c.step_started_on AS stepStartedOn,
             c.step_business_days AS stepBusinessDays
      ${APPEAL_FROM}
      WHERE a.id_disciplinary_appeals = ?
      LIMIT 1
      `,
      [appealId],
    )) as Array<Record<string, unknown>>;

    const row = rows[0];
    if (!row) {
      throw new ForbiddenException('No tiene autorización para consultar este recurso');
    }
    const facts = {
      studentUserId: Number(row.studentUserId),
      reporterUserId: Number(row.reporterUserId),
      responsibleUserId: row.responsibleUserId == null ? null : Number(row.responsibleUserId),
      groupId: Number(row.groupId),
    };
    if (!canViewCase(actor, facts)) {
      throw new ForbiddenException('No tiene autorización para consultar este recurso');
    }

    const caseId = Number(row.caseId);
    const [eventRows, appealRows, communicationRows, notificationRows] = await Promise.all([
      this.dataSource.query(
        `
        SELECT type,
               created_at AS createdAt,
               from_status AS fromStatus,
               to_status AS toStatus,
               payload,
               visibility
        FROM disciplinary_case_events
        WHERE id_disciplinary_cases = ?
        ORDER BY created_at ASC, id_disciplinary_case_events ASC
        `,
        [caseId],
      ) as Promise<Array<Record<string, unknown>>>,
      this.dataSource.query(
        `
        SELECT kind,
               is_subsidiary AS isSubsidiary,
               filed_at AS filedAt,
               resolved_at AS resolvedAt,
               outcome
        FROM disciplinary_appeals
        WHERE id_disciplinary_cases = ?
        ORDER BY filed_at ASC, id_disciplinary_appeals ASC
        `,
        [caseId],
      ) as Promise<Array<Record<string, unknown>>>,
      this.dataSource.query(
        `
        SELECT id_disciplinary_communications AS id,
               kind,
               issued_at AS issuedAt
        FROM disciplinary_communications
        WHERE id_disciplinary_cases = ?
        ORDER BY issued_at ASC, id_disciplinary_communications ASC
        `,
        [caseId],
      ) as Promise<Array<Record<string, unknown>>>,
      this.dataSource.query(
        `
        SELECT n.id_disciplinary_notifications AS id,
               n.id_disciplinary_communications AS communicationId,
               n.id_users_guardian AS guardianUserId,
               n.read_at AS readAt,
               comm.kind AS kind,
               comm.issued_at AS issuedAt
        FROM disciplinary_notifications n
        INNER JOIN disciplinary_communications comm
          ON comm.id_disciplinary_communications = n.id_disciplinary_communications
        WHERE comm.id_disciplinary_cases = ?
        ORDER BY comm.issued_at ASC, n.id_disciplinary_notifications ASC
        `,
        [caseId],
      ) as Promise<Array<Record<string, unknown>>>,
    ]);

    const publicEvents = visibleEvents(
      actor,
      facts,
      eventRows.map((event) => ({
        type: String(event.type),
        createdAt: event.createdAt,
        fromStatus: (event.fromStatus as string | null) ?? null,
        toStatus: (event.toStatus as string | null) ?? null,
        payload: parseJson(event.payload),
        visibility: String(event.visibility) as EventVisibility,
      })),
    );

    const listItem = this.toListItem(row, today, holidays);
    const resolution = this.toResolutionNotice(actor.userId, communicationRows, notificationRows);
    return {
      ...listItem,
      body: String(row.body ?? ''),
      reasoning: row.reasoning == null ? null : String(row.reasoning),
      witnesses: visibleWitnesses(actor, facts, (row.witnesses as string | null) ?? null),
      timeline: buildAppealTimeline({
        events: publicEvents,
        appeals: appealRows.map((item) => ({
          kind: item.kind as AppealKind,
          isSubsidiary: Boolean(item.isSubsidiary),
          filedAt: item.filedAt,
          resolvedAt: item.resolvedAt,
          outcome: (item.outcome as AppealOutcome | null) ?? null,
        })),
        communications: communicationRows.map((item) => ({
          kind: String(item.kind),
          issuedAt: item.issuedAt,
        })),
        notifications: notificationRows.map((item) => ({ readAt: item.readAt })),
      }),
      resolutionNotice: resolution,
    };
  }

  private toResolutionNotice(
    actorUserId: number,
    communications: Array<Record<string, unknown>>,
    notifications: Array<Record<string, unknown>>,
  ): AppealResolutionNotice | null {
    const issued = [...communications].reverse().find((item) => item.kind === CommunicationKind.APPEAL_RESOLUTION);
    const issuedAt = issued ? asIsoDateTime(issued.issuedAt) : null;
    if (!issued || !issuedAt) return null;
    const communicationId = Number(issued.id);
    const related = notifications.filter((item) => Number(item.communicationId) === communicationId);
    const own = related.find((item) => Number(item.guardianUserId) === actorUserId) ?? null;
    const firstRead = related.find((item) => item.readAt) ?? null;
    return {
      communicationId,
      issuedAt,
      notificationId: own ? Number(own.id) : null,
      readAt: asIsoDateTime(own?.readAt ?? firstRead?.readAt ?? null),
      canConfirm: Boolean(own && own.readAt == null),
    };
  }

  private listFilters(query: ListDisciplinaryAppealsQueryDto, actor: DisciplinaryActor) {
    const where: string[] = [];
    const params: Array<string | number> = [];
    if (query.kind) {
      where.push('a.kind = ?');
      params.push(query.kind);
    }
    if (query.outcome === AppealOutcomeFilter.PENDING) {
      where.push('a.outcome IS NULL');
    } else if (query.outcome) {
      where.push('a.outcome = ?');
      params.push(query.outcome);
    }
    if (query.caseId) {
      where.push('a.id_disciplinary_cases = ?');
      params.push(query.caseId);
    }
    if (query.studentUserId) {
      where.push('c.id_users_student = ?');
      params.push(query.studentUserId);
    }
    const scope = caseScopeClause(actor);
    if (scope) {
      where.push(scope.sql);
      params.push(...scope.params);
    }
    return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
  }

  private reviewFilters(query: ListDisciplinaryAppealsQueryDto, actor: DisciplinaryActor) {
    const where = ['a.outcome IS NULL'];
    const params: Array<string | number | boolean> = [];
    if (query.kind) {
      where.push('a.kind = ?');
      params.push(query.kind);
    }
    const admin = actorHasAdminPower(actor);
    const canRevocation = admin || actor.permissions.includes(PERMISSIONS.DISCIPLINARY_RESOLVE);
    const canAppeal = admin || actor.permissions.includes(PERMISSIONS.DISCIPLINARY_APPEAL);
    const kinds: string[] = [];
    if (canRevocation) {
      if (admin) {
        kinds.push(`a.kind = 'REVOCATION'`);
      } else {
        kinds.push(`(a.kind = 'REVOCATION' AND c.id_users_responsible = ?)`);
        params.push(actor.userId);
      }
    }
    if (canAppeal) {
      kinds.push(`a.kind = 'APPEAL'`);
    }
    if (!kinds.length) {
      where.push('1 = 0');
    } else {
      where.push(`(${kinds.join(' OR ')})`);
    }
    return { whereSql: `WHERE ${where.join(' AND ')}`, params };
  }

  private eligibleCaseFilters(actor: DisciplinaryActor) {
    const where = [
      `(
        (c.track = ? AND c.status = ?)
        OR (c.track = ? AND c.status = ?)
        OR c.status = ?
      )`,
    ];
    const params: Array<string | number> = [
      DisciplinaryTrack.DIRECT,
      DisciplinaryCaseStatus.NOTIFIED,
      DisciplinaryTrack.DUE_PROCESS,
      DisciplinaryCaseStatus.RESOLVED,
      DisciplinaryCaseStatus.IN_APPEAL,
    ];
    const scope = caseScopeClause(actor);
    if (scope) {
      where.push(`(${scope.sql} OR c.id_users_responsible = ?)`);
      params.push(...scope.params, actor.userId);
    }
    return { whereSql: `WHERE ${where.join(' AND ')}`, params };
  }

  private async loadAppealFacts(caseIds: number[]): Promise<Map<number, AppealFact[]>> {
    const map = new Map<number, AppealFact[]>();
    if (!caseIds.length) return map;
    const rows = (await this.dataSource.query(
      `
      SELECT id_disciplinary_cases AS caseId,
             kind,
             is_subsidiary AS isSubsidiary,
             outcome
      FROM disciplinary_appeals
      WHERE id_disciplinary_cases IN (${caseIds.map(() => '?').join(', ')})
      `,
      caseIds,
    )) as Array<Record<string, unknown>>;
    for (const row of rows) {
      const caseId = Number(row.caseId);
      const list = map.get(caseId) ?? [];
      list.push({
        kind: row.kind as AppealKind,
        isSubsidiary: Boolean(row.isSubsidiary),
        outcome: (row.outcome as AppealOutcome | null) ?? null,
      });
      map.set(caseId, list);
    }
    return map;
  }

  private toListItem(
    row: Record<string, unknown>,
    today: string,
    holidays: ReadonlySet<string>,
  ): DisciplinaryAppealListItem {
    const pending = row.outcome == null;
    const deadline = pending
      ? stepDeadline(asIsoDay(row.stepStartedOn), Number(row.stepBusinessDays), today, holidays)
      : { dueOn: null, deadline: DeadlineIndicator.NONE };
    const gradeLevel = row.gradeLevel == null ? null : Number(row.gradeLevel);
    const groupName = (row.groupName as string | null) ?? null;
    const caseSeverity = String(row.caseSeverity ?? '') as InfractionSeverity;
    const deduction = appealDeduction(row.caseStatus as DisciplinaryCaseStatus, caseSeverity);
    return {
      id: Number(row.id),
      caseId: Number(row.caseId),
      caseNumber: String(row.caseNumber),
      kind: row.kind as AppealKind,
      isSubsidiary: Boolean(row.isSubsidiary),
      outcome: (row.outcome as AppealOutcome | null) ?? null,
      filedAt: asIsoDateTime(row.filedAt),
      filedByUserId: Number(row.filedByUserId),
      resolvedAt: asIsoDateTime(row.resolvedAt),
      resolverUserId: row.resolverUserId == null ? null : Number(row.resolverUserId),
      caseStatus: row.caseStatus as DisciplinaryCaseStatus,
      track: row.track as DisciplinaryTrack,
      studentUserId: Number(row.studentUserId),
      studentFullName: [row.name, row.firstLastname, row.secondLastname].filter(Boolean).join(' '),
      sectionLabel: gradeLevel != null && groupName ? `${gradeLevel}-${groupName}` : groupName,
      groupId: Number(row.groupId),
      responsibleUserId: row.responsibleUserId == null ? null : Number(row.responsibleUserId),
      dueOn: deadline.dueOn,
      deadline: deadline.deadline,
      stepBusinessDays: Number(row.stepBusinessDays),
      caseSeverity,
      deduction: deduction.points,
      deductionState: deduction.state,
      deductionLabel: deduction.label,
    };
  }

  private toReviewItem(
    row: Record<string, unknown>,
    today: string,
    holidays: ReadonlySet<string>,
  ): DisciplinaryAppealReviewItem {
    return {
      ...this.toListItem(row, today, holidays),
      body: String(row.body ?? ''),
      caseSeverity: String(row.caseSeverity ?? ''),
    };
  }

  private async loadActor(actor: AuthenticatedUser): Promise<DisciplinaryActor> {
    const [guides, links] = await Promise.all([
      this.dataSource.query(
        `SELECT id_groups AS groupId FROM teaching_assignments WHERE id_users = ? AND is_guide_teacher = 1`,
        [actor.id],
      ) as Promise<Array<{ groupId: number }>>,
      this.dataSource.query(
        `SELECT id_users_student AS studentUserId FROM guardian_student_links WHERE id_users_guardian = ?`,
        [actor.id],
      ) as Promise<Array<{ studentUserId: number }>>,
    ]);
    const roleNames = (actor.roles ?? []).map(String);
    if (roleNames.includes(Role.ADMIN) && !roleNames.includes(INSTITUTIONAL_ROLE_ADMIN)) {
      roleNames.push(INSTITUTIONAL_ROLE_ADMIN);
    }
    return {
      userId: actor.id,
      permissions: actor.permissions ?? [],
      roleNames,
      guideGroupIds: guides.map((guide) => Number(guide.groupId)),
      linkedStudentIds: links.map((link) => Number(link.studentUserId)),
    };
  }

  private async holidaySet(): Promise<Set<string>> {
    const days = await this.nonWorkingDays.find();
    return new Set(days.map((day) => String(day.day).slice(0, 10)));
  }
}

function asIsoDay(value: unknown): string {
  return String(value ?? '').slice(0, 10);
}

function asIsoDateTime(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseJson(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
