import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { calendarDateInTimeZone } from '../../../common/utils/business-calendar-date.util';
import { Role } from '../../../common/enums/role.enum';
import {
  INSTITUTIONAL_ROLE_ADMIN,
  INSTITUTIONAL_ROLE_STUDENT,
} from '../../../common/constants/institutional-roles.constant';
import { AuditLog } from '../../administrative/users/entities/audit-log.entity';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { getSeverityRule, InfractionSeverity } from '../constants/infraction-severity.constant';
import { CommunicationKind, DisciplinaryCaseStatus, DisciplinaryTrack, EventVisibility } from '../constants/disciplinary.enums';
import { CreateDisciplinaryCaseDto } from '../dto/create-disciplinary-case.dto';
import { ListDisciplinaryCasesQueryDto } from '../dto/list-disciplinary-cases-query.dto';
import { StudentHistoryQueryDto } from '../dto/student-history-query.dto';
import { DisciplinaryCaseEventEntity } from '../entities/disciplinary-case-event.entity';
import { DisciplinaryCaseEntity } from '../entities/disciplinary-case.entity';
import { InfractionTypeEntity } from '../entities/infraction-type.entity';
import { NonWorkingDayEntity } from '../entities/non-working-day.entity';
import { institutionalToday } from '../utils/business-days';
import { formatCaseNumber, planCaseOpening } from './case-opening';
import { actorCanListCases, caseScopeClause, DeadlineIndicator, stepDeadline } from './case-read';
import { canSeeUnconfirmedAlert, unconfirmedNotificationAlerts } from './unconfirmed-notification';
import { personName, readReceiptLabel } from './read-receipt';
import { DisciplinaryAccessService } from './disciplinary-access.service';
import { canViewStudentHistory, DisciplinaryActor } from './disciplinary-access.policy';
import { buildConductHistory, ConductCaseInput } from './conduct-grade';
import { DisciplinaryCommunicationsService } from './disciplinary-communications.service';
import { DisciplinaryDeadlineService } from './disciplinary-deadline.service';
import { DISCIPLINARY_CASE_AUDIT_ENTITY } from './disciplinary-workflow.service';

export interface DisciplinaryStudentHit {
  id: number;
  fullName: string;
  nationalId: string;
  groupId: number | null;
  groupName: string | null;
  sectionName: string | null;
  gradeLevel: number | null;
  sectionLabel: string | null;
}

const CASES_PAGE_SIZE = 20;
const CASES_MAX_PAGE_SIZE = 100;

const CASE_FROM = `
  FROM disciplinary_cases c
  INNER JOIN users u ON u.id_users = c.id_users_student
  INNER JOIN \`groups\` g ON g.id_groups = c.id_groups
  LEFT JOIN sections s ON s.id_sections = g.id_sections
  INNER JOIN disciplinary_infraction_types t ON t.id_disciplinary_infraction_types = c.id_disciplinary_infraction_types
`;

interface EnrollmentRow {
  groupId: number;
  academicPeriodId: number;
  groupName: string;
  sectionName: string;
  gradeLevel: number;
}

@Injectable()
export class DisciplinaryCasesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(InfractionTypeEntity)
    private readonly types: Repository<InfractionTypeEntity>,
    @InjectRepository(NonWorkingDayEntity)
    private readonly nonWorkingDays: Repository<NonWorkingDayEntity>,
    private readonly communications: DisciplinaryCommunicationsService,
    private readonly access: DisciplinaryAccessService,
    private readonly deadlines: DisciplinaryDeadlineService,
  ) {}

  async searchStudents(q: string): Promise<DisciplinaryStudentHit[]> {
    const term = q.trim();
    if (term.length < 2) {
      throw new BadRequestException({
        code: 'STUDENT_QUERY_TOO_SHORT',
        message: 'Escriba al menos 2 caracteres',
        field: 'q',
      });
    }
    const like = `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
    const rows = await this.dataSource.query(
      `
      SELECT u.id_users AS id,
             u.name AS name,
             u.first_lastname AS firstLastname,
             u.second_lastname AS secondLastname,
             u.national_id AS nationalId,
             g.id_groups AS groupId,
             g.name AS groupName,
             s.name AS sectionName,
             s.grade_level AS gradeLevel
      FROM users u
      INNER JOIN user_roles ur ON ur.id_users = u.id_users
      INNER JOIN roles r ON r.id_roles = ur.id_roles AND r.name = ?
      LEFT JOIN group_enrollments e ON e.id_group_enrollments = (
        SELECT e2.id_group_enrollments
        FROM group_enrollments e2
        WHERE e2.id_users = u.id_users AND e2.status = 'ACTIVE'
        ORDER BY e2.starts_on DESC, e2.id_group_enrollments DESC
        LIMIT 1
      )
      LEFT JOIN \`groups\` g ON g.id_groups = e.id_groups
      LEFT JOIN sections s ON s.id_sections = g.id_sections
      WHERE u.status = 'ACTIVE'
        AND (
          u.name LIKE ? OR u.first_lastname LIKE ? OR u.second_lastname LIKE ?
          OR u.national_id LIKE ?
          OR CONCAT(u.name, ' ', u.first_lastname, ' ', IFNULL(u.second_lastname, '')) LIKE ?
        )
      ORDER BY u.first_lastname, u.name
      LIMIT 20
    `,
      [INSTITUTIONAL_ROLE_STUDENT, like, like, like, like, like],
    );
    return rows.map((row: Record<string, unknown>) => this.toHit(row));
  }

  async list(actorUser: AuthenticatedUser, query: ListDisciplinaryCasesQueryDto) {
    await this.deadlines.reconcileDeadlines();
    const actor = await this.loadActor(actorUser);
    if (!actorCanListCases(actor)) {
      throw new ForbiddenException('No tiene acceso a los expedientes');
    }
    const holidays = await this.holidaySet();
    const today = institutionalToday();
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? CASES_PAGE_SIZE, CASES_MAX_PAGE_SIZE);
    const { whereSql, params } = this.listFilters(query, actor);
    const rows = (await this.dataSource.query(
      `
      SELECT c.id_disciplinary_cases AS id,
             c.case_number AS caseNumber,
             c.status AS status,
             c.severity AS severity,
             c.track AS track,
             c.id_users_student AS studentUserId,
             u.name AS name,
             u.first_lastname AS firstLastname,
             u.second_lastname AS secondLastname,
             c.id_groups AS groupId,
             g.name AS groupName,
             s.name AS sectionName,
             s.grade_level AS gradeLevel,
             c.id_academic_periods AS academicPeriodId,
             c.occurred_at AS occurredAt,
             c.step_started_on AS stepStartedOn,
             c.step_business_days AS stepBusinessDays,
             c.is_late_report AS isLateReport,
             c.missing_guide_teacher AS missingGuideTeacher,
             c.created_at AS createdAt,
             t.name AS infractionName
      ${CASE_FROM}
      ${whereSql}
      ORDER BY c.created_at DESC, c.id_disciplinary_cases DESC
      `,
      params,
    )) as Array<Record<string, unknown>>;

    const viewed = rows.map((row) => {
      const deadline = stepDeadline(
        asIsoDay(row.stepStartedOn),
        Number(row.stepBusinessDays),
        today,
        holidays,
      );
      return { row, deadline };
    });
    const matched =
      query.deadline && query.deadline !== DeadlineIndicator.NONE
        ? viewed.filter((item) => item.deadline.deadline === query.deadline)
        : query.deadline === DeadlineIndicator.NONE
          ? viewed.filter((item) => item.deadline.deadline === DeadlineIndicator.NONE)
          : viewed;
    const pageRows = matched.slice((page - 1) * pageSize, page * pageSize);
    return {
      data: pageRows.map(({ row, deadline }) => this.toListItem(row, deadline)),
      total: matched.length,
      page,
      pageSize,
    };
  }

  async findOne(actorUser: AuthenticatedUser, caseId: number) {
    await this.deadlines.reconcileDeadlines();
    const actor = await this.loadActor(actorUser);
    if (!actorCanListCases(actor)) {
      throw new ForbiddenException('No tiene acceso a este expediente');
    }
    const rows = (await this.dataSource.query(
      `
      SELECT c.*,
             u.name AS studentName,
             u.first_lastname AS studentFirstLastname,
             u.second_lastname AS studentSecondLastname,
             u.national_id AS studentNationalId,
             g.name AS groupName,
             s.name AS sectionName,
             s.grade_level AS gradeLevel,
             t.name AS infractionName
      ${CASE_FROM}
      WHERE c.id_disciplinary_cases = ?
      LIMIT 1
      `,
      [caseId],
    )) as Array<Record<string, unknown>>;
    const row = rows[0];
    if (!row) {
      throw new NotFoundException({ code: 'CASE_NOT_FOUND', message: 'El expediente no existe' });
    }
    const facts = {
      studentUserId: Number(row.id_users_student),
      reporterUserId: Number(row.id_users_reporter),
      responsibleUserId: row.id_users_responsible == null ? null : Number(row.id_users_responsible),
      groupId: Number(row.id_groups),
    };
    this.access.assertCanView(actor, facts);

    const [events, evidences, followUps, readReceipts, defenses, appeals, precautionaryMeasures, unreadNotifications, communications] =
      await Promise.all([
      this.dataSource.query(
        `
        SELECT id_disciplinary_case_events AS id,
               type,
               id_users_actor AS actorUserId,
               from_status AS fromStatus,
               to_status AS toStatus,
               payload,
               visibility,
               created_at AS createdAt
        FROM disciplinary_case_events
        WHERE id_disciplinary_cases = ?
        ORDER BY created_at ASC, id_disciplinary_case_events ASC
        `,
        [caseId],
      ) as Promise<Array<Record<string, unknown>>>,
      this.dataSource.query(
        `
        SELECT id_disciplinary_evidences AS id,
               original_name AS originalName,
               mime_type AS mimeType,
               size_bytes AS sizeBytes,
               context,
               created_at AS createdAt
        FROM disciplinary_evidences
        WHERE id_disciplinary_cases = ?
        ORDER BY created_at ASC, id_disciplinary_evidences ASC
        `,
        [caseId],
      ) as Promise<Array<Record<string, unknown>>>,
      this.dataSource.query(
        `
        SELECT id_disciplinary_follow_ups AS id,
               kind,
               followed_on AS followedOn,
               description,
               participants,
               review_on AS reviewOn,
               outcome,
               outcome_note AS outcomeNote,
               id_users_author AS authorUserId,
               created_at AS createdAt
        FROM disciplinary_follow_ups
        WHERE id_disciplinary_cases = ?
        ORDER BY followed_on ASC, id_disciplinary_follow_ups ASC
        `,
        [caseId],
      ) as Promise<Array<Record<string, unknown>>>,
      this.dataSource.query(
        `
        SELECT n.id_disciplinary_notifications AS id,
               n.read_at AS readAt,
               u.name AS name,
               u.first_lastname AS firstLastname,
               u.second_lastname AS secondLastname
        FROM disciplinary_notifications n
        INNER JOIN disciplinary_communications comm
          ON comm.id_disciplinary_communications = n.id_disciplinary_communications
        INNER JOIN users u ON u.id_users = n.id_users_guardian
        WHERE comm.id_disciplinary_cases = ?
          AND n.read_at IS NOT NULL
        ORDER BY n.read_at ASC, n.id_disciplinary_notifications ASC
        `,
        [caseId],
      ) as Promise<Array<Record<string, unknown>>>,
      this.dataSource.query(
        `
        SELECT id_disciplinary_defenses AS id,
               body,
               channel,
               id_users_presented_by AS presentedByUserId,
               presented_at AS presentedAt
        FROM disciplinary_defenses
        WHERE id_disciplinary_cases = ?
        ORDER BY presented_at ASC, id_disciplinary_defenses ASC
        `,
        [caseId],
      ) as Promise<Array<Record<string, unknown>>>,
      this.dataSource.query(
        `
        SELECT id_disciplinary_appeals AS id,
               kind,
               is_subsidiary AS isSubsidiary,
               body,
               filed_at AS filedAt,
               id_users_filed_by AS filedByUserId,
               outcome,
               new_severity AS newSeverity,
               reasoning,
               id_users_resolver AS resolverUserId,
               resolved_at AS resolvedAt
        FROM disciplinary_appeals
        WHERE id_disciplinary_cases = ?
        ORDER BY filed_at ASC, id_disciplinary_appeals ASC
        `,
        [caseId],
      ) as Promise<Array<Record<string, unknown>>>,
      this.dataSource.query(
        `
        SELECT id_disciplinary_precautionary_measures AS id,
               starts_on AS startsOn,
               ends_on AS endsOn,
               reason,
               pani_coordination AS paniCoordination,
               id_users_ordered_by AS orderedByUserId,
               created_at AS createdAt
        FROM disciplinary_precautionary_measures
        WHERE id_disciplinary_cases = ?
        ORDER BY starts_on ASC, id_disciplinary_precautionary_measures ASC
        `,
        [caseId],
      ) as Promise<Array<Record<string, unknown>>>,
      this.dataSource.query(
        `
        SELECT n.id_disciplinary_notifications AS notificationId,
               n.read_at AS readAt,
               comm.issued_at AS issuedAt
        FROM disciplinary_notifications n
        INNER JOIN disciplinary_communications comm
          ON comm.id_disciplinary_communications = n.id_disciplinary_communications
        WHERE comm.id_disciplinary_cases = ?
          AND n.read_at IS NULL
        `,
        [caseId],
      ) as Promise<Array<Record<string, unknown>>>,
      this.dataSource.query(
        `
        SELECT id_disciplinary_communications AS id,
               kind,
               issued_at AS issuedAt,
               delivery_medium AS deliveryMedium,
               delivered_at AS deliveredAt,
               received_by_name AS receivedByName
        FROM disciplinary_communications
        WHERE id_disciplinary_cases = ?
        ORDER BY issued_at ASC, id_disciplinary_communications ASC
        `,
        [caseId],
      ) as Promise<Array<Record<string, unknown>>>,
    ]);
    const timeline: TimelineEvent[] = events.map((event) => ({
      id: event.id,
      type: event.type,
      actorUserId: event.actorUserId,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      payload: event.payload,
      visibility: String(event.visibility) as EventVisibility,
      createdAt: event.createdAt,
    }));
    const visibleEvents = this.access.eventsFor(actor, facts, timeline);
    const actorNames = await this.actorNames(
      visibleEvents
        .map((event) => (event.actorUserId == null ? null : Number(event.actorUserId)))
        .filter((id): id is number => id != null),
    );
    const holidays = await this.holidaySet();
    const deadline = stepDeadline(
      asIsoDay(row.step_started_on),
      Number(row.step_business_days),
      institutionalToday(),
      holidays,
    );
    const alerts = canSeeUnconfirmedAlert(actor, facts.responsibleUserId)
      ? unconfirmedNotificationAlerts(
          unreadNotifications.map((item) => ({
            notificationId: Number(item.notificationId),
            issuedOn: calendarDateInTimeZone(new Date(String(item.issuedAt))),
            readAt: (item.readAt as Date | string | null) ?? null,
          })),
          institutionalToday(),
          holidays,
        )
      : [];
    const severity = String(row.severity) as Parameters<typeof getSeverityRule>[0];
    const rule = getSeverityRule(severity);
    const gradeLevel = row.gradeLevel == null ? null : Number(row.gradeLevel);
    const groupName = (row.groupName as string | null) ?? null;
    return {
      id: Number(row.id_disciplinary_cases),
      caseNumber: String(row.case_number),
      status: row.status,
      track: row.track,
      severity: row.severity,
      severityLabel: rule.label,
      deduction: rule.deduction,
      originalSeverity: row.original_severity,
      occurredAt: asIsoDateTime(row.occurred_at),
      place: row.place,
      description: row.description,
      witnesses: this.access.witnessesFor(actor, facts, (row.witnesses as string | null) ?? null),
      isLateReport: Boolean(row.is_late_report),
      lateReportReason: row.late_report_reason,
      missingGuideTeacher: Boolean(row.missing_guide_teacher),
      student: {
        id: facts.studentUserId,
        fullName: [row.studentName, row.studentFirstLastname, row.studentSecondLastname]
          .filter(Boolean)
          .join(' '),
        nationalId: String(row.studentNationalId ?? ''),
      },
      groupId: facts.groupId,
      groupName,
      sectionName: (row.sectionName as string | null) ?? null,
      gradeLevel,
      sectionLabel: gradeLevel != null && groupName ? `${gradeLevel}-${groupName}` : groupName,
      academicPeriodId: Number(row.id_academic_periods),
      infractionType: { id: Number(row.id_disciplinary_infraction_types), name: row.infractionName },
      subjectId: row.id_subjects == null ? null : Number(row.id_subjects),
      reporterUserId: facts.reporterUserId,
      responsibleUserId: facts.responsibleUserId,
      stepStartedOn: asIsoDay(row.step_started_on),
      stepBusinessDays: Number(row.step_business_days),
      dueOn: deadline.dueOn,
      deadline: deadline.deadline,
      resolutionOutcome: row.resolution_outcome,
      resolutionReasoning: row.resolution_reasoning,
      notifiedAt: asIsoDateTime(row.notified_at),
      firmAt: asIsoDateTime(row.firm_at),
      evidences: evidences.map((evidence) => ({
        id: Number(evidence.id),
        originalName: evidence.originalName,
        mimeType: evidence.mimeType,
        sizeBytes: Number(evidence.sizeBytes),
        context: evidence.context,
        createdAt: asIsoDateTime(evidence.createdAt),
      })),
      events: visibleEvents.map((event) => ({
        id: Number(event.id),
        type: event.type,
        actorUserId: event.actorUserId == null ? null : Number(event.actorUserId),
        actorName:
          event.actorUserId == null ? null : (actorNames.get(Number(event.actorUserId)) ?? null),
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        payload: parsePayload(event.payload),
        visibility: event.visibility,
        createdAt: asIsoDateTime(event.createdAt),
      })),
      followUps: followUps.map((item) => ({
        id: Number(item.id),
        kind: item.kind,
        followedOn: asIsoDay(item.followedOn),
        description: item.description,
        participants: item.participants,
        reviewOn: item.reviewOn == null ? null : asIsoDay(item.reviewOn),
        outcome: item.outcome,
        outcomeNote: item.outcomeNote,
        authorUserId: Number(item.authorUserId),
        createdAt: asIsoDateTime(item.createdAt),
      })),
      readReceipts: readReceipts.map((item) => {
        const readAt = new Date(String(item.readAt));
        const guardianName = personName(item);
        return {
          id: Number(item.id),
          guardianName,
          readAt: readAt.toISOString(),
          label: readReceiptLabel(guardianName || 'el encargado', readAt),
        };
      }),
      defenses: defenses.map((item) => ({
        id: Number(item.id),
        body: item.body,
        channel: item.channel,
        presentedByUserId: Number(item.presentedByUserId),
        presentedAt: asIsoDateTime(item.presentedAt),
      })),
      appeals: appeals.map((item) => ({
        id: Number(item.id),
        kind: item.kind,
        isSubsidiary: Boolean(item.isSubsidiary),
        body: item.body,
        filedAt: asIsoDateTime(item.filedAt),
        filedByUserId: Number(item.filedByUserId),
        outcome: item.outcome,
        newSeverity: item.newSeverity,
        reasoning: item.reasoning,
        resolverUserId: item.resolverUserId == null ? null : Number(item.resolverUserId),
        resolvedAt: asIsoDateTime(item.resolvedAt),
      })),
      precautionaryMeasures: precautionaryMeasures.map((item) => ({
        id: Number(item.id),
        startsOn: asIsoDay(item.startsOn),
        endsOn: asIsoDay(item.endsOn),
        reason: item.reason,
        paniCoordination: Boolean(item.paniCoordination),
        orderedByUserId: Number(item.orderedByUserId),
        createdAt: asIsoDateTime(item.createdAt),
      })),
      communications: communications.map((item) => ({
        id: Number(item.id),
        kind: String(item.kind),
        issuedAt: asIsoDateTime(item.issuedAt),
        deliveryMedium: item.deliveryMedium == null ? null : String(item.deliveryMedium),
        deliveredAt: asIsoDateTime(item.deliveredAt),
        receivedByName: item.receivedByName == null ? null : String(item.receivedByName),
      })),
      alerts,
    };
  }

  async history(actorUser: AuthenticatedUser, studentUserId: number, query: StudentHistoryQueryDto) {
    await this.deadlines.reconcileDeadlines();
    if (
      !actorCanListCases({
        userId: actorUser.id,
        permissions: actorUser.permissions ?? [],
        roleNames: actorUser.roles ?? [],
        guideGroupIds: [],
        linkedStudentIds: [],
      })
    ) {
      throw new ForbiddenException('No tiene acceso a los expedientes');
    }
    const actor = await this.loadActor(actorUser);
    const students = (await this.dataSource.query(
      `
      SELECT u.id_users AS id,
             u.name AS name,
             u.first_lastname AS firstLastname,
             u.second_lastname AS secondLastname,
             u.national_id AS nationalId
      FROM users u
      INNER JOIN user_roles ur ON ur.id_users = u.id_users
      INNER JOIN roles r ON r.id_roles = ur.id_roles AND r.name = ?
      WHERE u.id_users = ?
      LIMIT 1
      `,
      [INSTITUTIONAL_ROLE_STUDENT, studentUserId],
    )) as Array<Record<string, unknown>>;
    const student = students[0];
    if (!student) {
      throw new NotFoundException({ code: 'STUDENT_NOT_FOUND', message: 'El estudiante no existe' });
    }
    const enrollments = (await this.dataSource.query(
      `SELECT id_groups AS groupId FROM group_enrollments WHERE id_users = ? AND status = 'ACTIVE'`,
      [studentUserId],
    )) as Array<{ groupId: number }>;
    if (!canViewStudentHistory(actor, studentUserId, enrollments.map((row) => Number(row.groupId)))) {
      throw new ForbiddenException('No tiene acceso al historial de este estudiante');
    }

    const params: unknown[] = [studentUserId];
    let periodSql = '';
    if (query.academicPeriodId) {
      periodSql = ' AND c.id_academic_periods = ?';
      params.push(query.academicPeriodId);
    }
    const rows = (await this.dataSource.query(
      `
      SELECT c.id_disciplinary_cases AS id,
             c.case_number AS caseNumber,
             c.status AS status,
             c.severity AS severity,
             c.track AS track,
             c.id_academic_periods AS academicPeriodId,
             p.name AS periodName,
             c.occurred_at AS occurredAt,
             t.name AS infractionName
      FROM disciplinary_cases c
      INNER JOIN academic_periods p ON p.id_academic_periods = c.id_academic_periods
      INNER JOIN disciplinary_infraction_types t
        ON t.id_disciplinary_infraction_types = c.id_disciplinary_infraction_types
      WHERE c.id_users_student = ?${periodSql}
      ORDER BY c.id_academic_periods DESC, c.occurred_at DESC, c.id_disciplinary_cases DESC
      `,
      params,
    )) as Array<Record<string, unknown>>;

    const cases: ConductCaseInput[] = rows.map((row) => ({
      id: Number(row.id),
      caseNumber: String(row.caseNumber),
      status: String(row.status) as DisciplinaryCaseStatus,
      severity: String(row.severity) as InfractionSeverity,
      track: String(row.track),
      academicPeriodId: Number(row.academicPeriodId),
      periodName: String(row.periodName),
      occurredAt: asIsoDateTime(row.occurredAt),
      infractionName: String(row.infractionName),
    }));

    return {
      student: {
        id: Number(student.id),
        fullName: personName(student),
        nationalId: String(student.nationalId ?? ''),
      },
      periods: buildConductHistory(cases, { status: query.status, severity: query.severity }),
    };
  }

  async create(actor: AuthenticatedUser, dto: CreateDisciplinaryCaseDto) {
    const type = await this.types.findOne({ where: { id: dto.infractionTypeId, isActive: true } });
    if (!type) {
      throw new NotFoundException({
        code: 'INFRACTION_TYPE_NOT_FOUND',
        message: 'El tipo de falta no existe o está inactivo',
      });
    }
    const occurredAt = new Date(dto.occurredAt);
    if (Number.isNaN(occurredAt.getTime()) || occurredAt.getTime() > Date.now()) {
      throw new BadRequestException({
        code: 'FUTURE_INCIDENT',
        message: 'La fecha del hecho no puede ser futura',
        field: 'occurredAt',
      });
    }

    const occurredOn = calendarDateInTimeZone(occurredAt);
    const today = institutionalToday();
    const rule = getSeverityRule(type.severity);
    const holidays = new Set(
      (await this.nonWorkingDays.find()).map((day) => String(day.day).slice(0, 10)),
    );

    const result = await this.dataSource.transaction(async (manager) => {
      const enrollment = await this.findEnrollment(manager, dto.studentUserId, occurredOn);
      if (!enrollment) {
        throw new BadRequestException({
          code: 'NO_ACTIVE_ENROLLMENT',
          message: 'El estudiante no tiene una matrícula activa en una sección',
          field: 'studentUserId',
        });
      }
      if (dto.subjectId != null) {
        const subjects = await manager.query(
          'SELECT id_subjects AS id FROM subjects WHERE id_subjects = ? LIMIT 1',
          [dto.subjectId],
        );
        if (!subjects.length) {
          throw new BadRequestException({
            code: 'SUBJECT_NOT_FOUND',
            message: 'La asignatura no existe',
            field: 'subjectId',
          });
        }
      }

      const guideUserId = await this.findGuide(manager, enrollment.groupId);
      const opening = planCaseOpening({
        track: rule.track,
        occurredOn,
        today,
        reporterUserId: actor.id,
        guideUserId,
        lateReportReason: dto.lateReportReason,
        nonWorkingDays: holidays,
      });
      const caseNumber = await this.nextCaseNumber(manager, Number(today.slice(0, 4)));
      const cases = manager.getRepository(DisciplinaryCaseEntity);
      const saved = await cases.save(
        cases.create({
          caseNumber,
          studentUserId: dto.studentUserId,
          groupId: enrollment.groupId,
          academicPeriodId: enrollment.academicPeriodId,
          infractionTypeId: type.id,
          subjectId: dto.subjectId ?? null,
          originalSeverity: type.severity,
          severity: type.severity,
          track: rule.track,
          status: opening.status,
          occurredAt,
          place: dto.place.trim(),
          description: dto.description.trim(),
          witnesses: dto.witnesses?.trim() || null,
          isLateReport: opening.isLateReport,
          lateReportReason: opening.lateReportReason,
          missingGuideTeacher: opening.missingGuideTeacher,
          reporterUserId: actor.id,
          responsibleUserId: opening.responsibleUserId,
          stepStartedOn: opening.stepStartedOn,
          stepBusinessDays: opening.stepBusinessDays,
        }),
      );

      const events = manager.getRepository(DisciplinaryCaseEventEntity);
      await events.save(
        events.create({
          caseId: saved.id,
          type: 'CASE_OPENED',
          actorUserId: actor.id,
          fromStatus: null,
          toStatus: opening.status,
          payload: { note: 'Apertura del expediente', caseNumber },
          visibility: EventVisibility.PUBLIC,
        }),
      );
      const audit = manager.getRepository(AuditLog);
      await audit.save(
        audit.create({
          actorId: actor.id,
          action: 'CASE_CREATE',
          entity: DISCIPLINARY_CASE_AUDIT_ENTITY,
          entityId: String(saved.id),
          before: null,
          after: { caseNumber, status: opening.status, track: rule.track },
        }),
      );

      let communicationId: number | null = null;
      let pendingMails: Awaited<ReturnType<DisciplinaryCommunicationsService['issue']>>['pending'] = [];
      if (rule.track === DisciplinaryTrack.DIRECT) {
        const issued = await this.communications.issue(manager, {
          caseId: saved.id,
          kind: CommunicationKind.DIRECT_REPRIMAND,
          issuerUserId: actor.id,
          studentUserId: dto.studentUserId,
          subject: `Amonestación ${caseNumber}`,
          body: [
            `Amonestación directa ${caseNumber}.`,
            `Falta: ${type.name} (${rule.label}, rebajo propuesto de ${rule.deduction} puntos).`,
            `Fecha del hecho: ${occurredOn}.`,
            `Lugar: ${dto.place.trim()}.`,
            `Hechos: ${dto.description.trim()}`,
            'Contra este acto cabe recurso de revocatoria dentro de los 3 días hábiles siguientes. El rebajo se aplica solo cuando el acto quede firme.',
          ].join('\n'),
        });
        communicationId = issued.communicationId;
        pendingMails = issued.pending;
        if (issued.notified) {
          await manager.update(DisciplinaryCaseEntity, saved.id, { notifiedAt: new Date() });
        }
      }

      return {
        pendingMails,
        view: {
          id: saved.id,
          caseNumber: saved.caseNumber,
          status: saved.status,
          track: saved.track,
          severity: saved.severity,
          severityLabel: rule.label,
          deduction: rule.deduction,
          missingGuideTeacher: saved.missingGuideTeacher,
          isLateReport: saved.isLateReport,
          groupId: enrollment.groupId,
          groupName: enrollment.groupName,
          sectionName: enrollment.sectionName,
          gradeLevel: enrollment.gradeLevel,
          responsibleUserId: saved.responsibleUserId,
          communicationId,
        },
      };
    });
    await this.communications.dispatch(result.pendingMails);
    return result.view;
  }

  private async findEnrollment(
    manager: EntityManager,
    studentUserId: number,
    occurredOn: string,
  ): Promise<EnrollmentRow | null> {
    const rows = await manager.query(
      `
      SELECT e.id_groups AS groupId,
             e.id_academic_periods AS academicPeriodId,
             g.name AS groupName,
             s.name AS sectionName,
             s.grade_level AS gradeLevel
      FROM group_enrollments e
      INNER JOIN \`groups\` g ON g.id_groups = e.id_groups
      INNER JOIN sections s ON s.id_sections = g.id_sections
      INNER JOIN user_roles ur ON ur.id_users = e.id_users
      INNER JOIN roles r ON r.id_roles = ur.id_roles AND r.name = ?
      WHERE e.id_users = ?
        AND e.status = 'ACTIVE'
        AND e.starts_on <= ?
        AND (e.ends_on IS NULL OR e.ends_on >= ?)
      ORDER BY e.starts_on DESC, e.id_group_enrollments DESC
      LIMIT 1
    `,
      [INSTITUTIONAL_ROLE_STUDENT, studentUserId, occurredOn, occurredOn],
    );
    return rows[0] ?? null;
  }

  private async findGuide(manager: EntityManager, groupId: number): Promise<number | null> {
    const rows = await manager.query(
      `
      SELECT id_users AS userId
      FROM teaching_assignments
      WHERE id_groups = ? AND is_guide_teacher = 1
      ORDER BY id_teaching_assignments DESC
      LIMIT 1
    `,
      [groupId],
    );
    return rows[0] ? Number(rows[0].userId) : null;
  }

  private async nextCaseNumber(manager: EntityManager, year: number): Promise<string> {
    await manager.query(
      `INSERT INTO disciplinary_case_sequences (\`year\`, \`last_value\`)
       VALUES (?, 0)
       ON DUPLICATE KEY UPDATE \`last_value\` = \`last_value\``,
      [year],
    );
    const rows = await manager.query(
      'SELECT `last_value` AS lastValue FROM disciplinary_case_sequences WHERE `year` = ? FOR UPDATE',
      [year],
    );
    const next = Number(rows[0].lastValue) + 1;
    await manager.query('UPDATE disciplinary_case_sequences SET `last_value` = ? WHERE `year` = ?', [
      next,
      year,
    ]);
    return formatCaseNumber(year, next);
  }

  private listFilters(query: ListDisciplinaryCasesQueryDto, actor: DisciplinaryActor) {
    const where: string[] = [];
    const params: Array<string | number> = [];
    if (query.status) {
      where.push('c.status = ?');
      params.push(query.status);
    }
    if (query.severity) {
      where.push('c.severity = ?');
      params.push(query.severity);
    }
    if (query.groupId) {
      where.push('c.id_groups = ?');
      params.push(query.groupId);
    }
    if (query.academicPeriodId) {
      where.push('c.id_academic_periods = ?');
      params.push(query.academicPeriodId);
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

  private toListItem(
    row: Record<string, unknown>,
    deadline: { dueOn: string | null; deadline: DeadlineIndicator },
  ) {
    const rule = getSeverityRule(String(row.severity) as Parameters<typeof getSeverityRule>[0]);
    const gradeLevel = row.gradeLevel == null ? null : Number(row.gradeLevel);
    const groupName = (row.groupName as string | null) ?? null;
    return {
      id: Number(row.id),
      caseNumber: String(row.caseNumber),
      status: row.status,
      severity: row.severity,
      severityLabel: rule.label,
      deduction: rule.deduction,
      track: row.track,
      studentUserId: Number(row.studentUserId),
      studentFullName: [row.name, row.firstLastname, row.secondLastname].filter(Boolean).join(' '),
      groupId: Number(row.groupId),
      sectionLabel: gradeLevel != null && groupName ? `${gradeLevel}-${groupName}` : groupName,
      academicPeriodId: Number(row.academicPeriodId),
      infractionName: row.infractionName,
      occurredAt: asIsoDateTime(row.occurredAt),
      dueOn: deadline.dueOn,
      deadline: deadline.deadline,
      isLateReport: Boolean(row.isLateReport),
      missingGuideTeacher: Boolean(row.missingGuideTeacher),
      createdAt: asIsoDateTime(row.createdAt),
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

  private async actorNames(ids: number[]): Promise<Map<number, string>> {
    const unique = [...new Set(ids)];
    if (!unique.length) return new Map();
    const rows = (await this.dataSource.query(
      `SELECT id_users AS id, name, first_lastname AS firstLastname, second_lastname AS secondLastname
       FROM users WHERE id_users IN (${unique.map(() => '?').join(', ')})`,
      unique,
    )) as Array<Record<string, unknown>>;
    return new Map(
      rows.map((row) => [
        Number(row.id),
        [row.name, row.firstLastname, row.secondLastname].filter(Boolean).join(' '),
      ]),
    );
  }

  private toHit(row: Record<string, unknown>): DisciplinaryStudentHit {
    const gradeLevel = row.gradeLevel == null ? null : Number(row.gradeLevel);
    const groupName = (row.groupName as string | null) ?? null;
    return {
      id: Number(row.id),
      fullName: [row.name, row.firstLastname, row.secondLastname].filter(Boolean).join(' '),
      nationalId: String(row.nationalId),
      groupId: row.groupId == null ? null : Number(row.groupId),
      groupName,
      sectionName: (row.sectionName as string | null) ?? null,
      gradeLevel,
      sectionLabel: gradeLevel != null && groupName ? `${gradeLevel}-${groupName}` : groupName,
    };
  }
}

function asIsoDay(value: unknown): string {
  if (value instanceof Date) {
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    return `${value.getUTCFullYear()}-${month}-${day}`;
  }
  return String(value ?? '').slice(0, 10);
}

function asIsoDateTime(value: unknown): string | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

interface TimelineEvent {
  id: unknown;
  type: unknown;
  actorUserId: unknown;
  fromStatus: unknown;
  toStatus: unknown;
  payload: unknown;
  visibility: EventVisibility;
  createdAt: unknown;
}

function parsePayload(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  if (typeof value === 'object') return value as Record<string, unknown>;
  try {
    return JSON.parse(String(value)) as Record<string, unknown>;
  } catch {
    return null;
  }
}
