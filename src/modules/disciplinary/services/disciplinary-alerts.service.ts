import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { calendarDateInTimeZone } from '../../../common/utils/business-calendar-date.util';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { INSTITUTIONAL_ROLE_ADMIN } from '../../../common/constants/institutional-roles.constant';
import { Role } from '../../../common/enums/role.enum';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { DisciplinaryCaseStatus } from '../constants/disciplinary.enums';
import { InfractionSeverity } from '../constants/infraction-severity.constant';
import { actorCanListCases, caseScopeClause } from './case-read';
import { AlertCaseFact, buildDisciplinaryAlerts } from './disciplinary-alert-rules';
import { canViewAllCases, DisciplinaryActor } from './disciplinary-access.policy';
import { institutionalToday } from '../utils/business-days';
import { canSeeUnconfirmedAlert, unconfirmedNotificationAlerts } from './unconfirmed-notification';

interface AlertRow {
  notificationId: number;
  caseId: number;
  caseNumber: string;
  responsibleUserId: number | null;
  issuedAt: Date | string;
}

@Injectable()
export class DisciplinaryAlertsService {
  constructor(private readonly dataSource: DataSource) {}

  async list(actorUser: AuthenticatedUser, today = institutionalToday()) {
    if (!actorCanListCases(this.asActor(actorUser))) {
      throw new ForbiddenException('No tiene acceso a las alertas disciplinarias');
    }
    const actor = await this.loadActor(actorUser);
    const scope = canViewAllCases(actor) ? null : caseScopeClause(actor);
    const params: number[] = [];
    let scopeSql = '';
    if (scope) {
      scopeSql = `WHERE ${scope.sql}`;
      params.push(...scope.params);
    }
    const [settings, holidayRows, cases, unconfirmed] = await Promise.all([
      this.dataSource.query(
        `
        SELECT recidivism_threshold AS recidivismThreshold,
               conduct_alert_threshold AS conductAlertThreshold
        FROM disciplinary_settings
        LIMIT 1
        `,
      ) as Promise<Array<{ recidivismThreshold: number; conductAlertThreshold: number }>>,
      this.dataSource.query('SELECT day FROM non_working_days') as Promise<Array<{ day: string | Date }>>,
      this.dataSource.query(
        `
        SELECT c.id_disciplinary_cases AS id,
               c.case_number AS caseNumber,
               c.id_users_student AS studentUserId,
               c.id_groups AS groupId,
               c.id_academic_periods AS academicPeriodId,
               c.status AS status,
               c.severity AS severity,
               c.id_users_responsible AS responsibleUserId,
               c.missing_guide_teacher AS missingGuideTeacher,
               c.step_started_on AS stepStartedOn,
               c.step_business_days AS stepBusinessDays
        FROM disciplinary_cases c
        ${scopeSql}
        `,
        params,
      ) as Promise<Array<Record<string, unknown>>>,
      this.listUnconfirmed(actorUser, today),
    ]);
    const threshold = settings[0];
    const holidays = new Set(holidayRows.map((row) => String(row.day).slice(0, 10)));
    return {
      items: buildDisciplinaryAlerts({
        actor,
        cases: cases.map((row) => this.toAlertCase(row)),
        unconfirmed: unconfirmed.items,
        recidivismThreshold: Number(threshold?.recidivismThreshold ?? 3),
        conductAlertThreshold: Number(threshold?.conductAlertThreshold ?? 80),
        today,
        holidays,
      }),
    };
  }

  async listUnconfirmed(actorUser: AuthenticatedUser, today = institutionalToday()) {
    if (!actorCanListCases(this.asActor(actorUser))) {
      throw new ForbiddenException('No tiene acceso a las alertas disciplinarias');
    }
    const actor = await this.loadActor(actorUser);
    const holidays = await this.holidaySet();
    const scope = canViewAllCases(actor) ? null : caseScopeClause(actor);
    const params: Array<number | string> = [];
    let scopeSql = '';
    if (scope) {
      scopeSql = `AND ${scope.sql.replaceAll('c.', 'cases.')}`;
      params.push(...scope.params);
    }
    if (!canViewAllCases(actor)) {
      scopeSql += ' AND cases.id_users_responsible = ?';
      params.push(actor.userId);
    }
    const rows = (await this.dataSource.query(
      `
      SELECT n.id_disciplinary_notifications AS notificationId,
             cases.id_disciplinary_cases AS caseId,
             cases.case_number AS caseNumber,
             cases.id_users_responsible AS responsibleUserId,
             comm.issued_at AS issuedAt
      FROM disciplinary_notifications n
      INNER JOIN disciplinary_communications comm
        ON comm.id_disciplinary_communications = n.id_disciplinary_communications
      INNER JOIN disciplinary_cases cases ON cases.id_disciplinary_cases = comm.id_disciplinary_cases
      WHERE n.read_at IS NULL
      ${scopeSql}
      ORDER BY comm.issued_at ASC, n.id_disciplinary_notifications ASC
      `,
      params,
    )) as AlertRow[];
    const items = rows.flatMap((row) => {
      const responsibleUserId = row.responsibleUserId == null ? null : Number(row.responsibleUserId);
      if (!canSeeUnconfirmedAlert(actor, responsibleUserId)) return [];
      const issuedOn = calendarDateInTimeZone(new Date(row.issuedAt));
      return unconfirmedNotificationAlerts(
        [{ notificationId: Number(row.notificationId), issuedOn, readAt: null }],
        today,
        holidays,
      ).map((alert) => ({
        ...alert,
        caseId: Number(row.caseId),
        caseNumber: row.caseNumber,
      }));
    });
    return { items };
  }

  private toAlertCase(row: Record<string, unknown>): AlertCaseFact {
    return {
      id: Number(row.id),
      caseNumber: String(row.caseNumber),
      studentUserId: Number(row.studentUserId),
      groupId: Number(row.groupId),
      academicPeriodId: Number(row.academicPeriodId),
      status: String(row.status) as DisciplinaryCaseStatus,
      severity: String(row.severity) as InfractionSeverity,
      responsibleUserId: row.responsibleUserId == null ? null : Number(row.responsibleUserId),
      missingGuideTeacher: Boolean(row.missingGuideTeacher),
      stepStartedOn: String(row.stepStartedOn ?? '').slice(0, 10),
      stepBusinessDays: Number(row.stepBusinessDays ?? 0),
    };
  }

  private async holidaySet(): Promise<Set<string>> {
    const rows = (await this.dataSource.query('SELECT day FROM non_working_days')) as Array<{ day: string | Date }>;
    return new Set(rows.map((row) => String(row.day).slice(0, 10)));
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

  private asActor(actor: AuthenticatedUser): DisciplinaryActor {
    return {
      userId: actor.id,
      permissions: actor.permissions ?? [],
      roleNames: (actor.roles ?? []).map(String),
      guideGroupIds: [],
      linkedStudentIds: [],
    };
  }
}
