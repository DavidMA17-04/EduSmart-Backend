import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { calendarDateInTimeZone } from '../../../common/utils/business-calendar-date.util';
import { INSTITUTIONAL_ROLE_ADMIN } from '../../../common/constants/institutional-roles.constant';
import { Role } from '../../../common/enums/role.enum';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { DisciplinaryCaseStatus } from '../constants/disciplinary.enums';
import { InfractionSeverity } from '../constants/infraction-severity.constant';
import { DisciplinaryDashboardQueryDto } from '../dto/disciplinary-dashboard-query.dto';
import { buildDashboard, DashboardCaseFact, emptyDashboard } from './disciplinary-dashboard';
import { DisciplinaryAlertsService } from './disciplinary-alerts.service';
import { canViewAllCases, DisciplinaryActor } from './disciplinary-access.policy';
import { DisciplinaryDeadlineService } from './disciplinary-deadline.service';
import { institutionalToday } from '../utils/business-days';

export type { DisciplinaryDashboard } from './disciplinary-dashboard';

@Injectable()
export class DisciplinaryDashboardService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly alerts: DisciplinaryAlertsService,
    private readonly deadlines: DisciplinaryDeadlineService,
  ) {}

  async get(actorUser: AuthenticatedUser, query: DisciplinaryDashboardQueryDto, today = institutionalToday()) {
    await this.deadlines.reconcileDeadlines(today);
    const actor = await this.loadActor(actorUser);
    if (!canViewAllCases(actor) && actor.guideGroupIds.length === 0) {
      throw new ForbiddenException('No tiene acceso al tablero disciplinario');
    }
    const scope = this.scope(actor, query);
    if (!scope) return emptyDashboard();

    const [holidayRows, rows, alerts] = await Promise.all([
      this.dataSource.query('SELECT day FROM non_working_days') as Promise<Array<{ day: string | Date }>>,
      this.dataSource.query(
        `
        SELECT c.id_disciplinary_cases AS id,
               c.status AS status,
               c.severity AS severity,
               c.id_users_student AS studentUserId,
               u.name AS name,
               u.first_lastname AS firstLastname,
               u.second_lastname AS secondLastname,
               c.id_groups AS groupId,
               g.name AS groupName,
               s.grade_level AS gradeLevel,
               c.occurred_at AS occurredAt,
               c.step_started_on AS stepStartedOn,
               c.step_business_days AS stepBusinessDays
        FROM disciplinary_cases c
        INNER JOIN users u ON u.id_users = c.id_users_student
        INNER JOIN \`groups\` g ON g.id_groups = c.id_groups
        LEFT JOIN sections s ON s.id_sections = g.id_sections
        ${scope.whereSql}
        `,
        scope.params,
      ) as Promise<Array<Record<string, unknown>>>,
      this.alerts.list(actorUser, today),
    ]);
    const holidays = new Set(holidayRows.map((row) => String(row.day).slice(0, 10)));
    return buildDashboard(
      rows.map((row) => this.toFact(row)),
      alerts.items,
      today,
      holidays,
      canViewAllCases(actor),
    );
  }

  private scope(
    actor: DisciplinaryActor,
    query: DisciplinaryDashboardQueryDto,
  ): { whereSql: string; params: number[] } | null {
    const where: string[] = [];
    const params: number[] = [];
    if (!canViewAllCases(actor)) {
      const allowed = query.groupId
        ? actor.guideGroupIds.filter((groupId) => groupId === query.groupId)
        : [...actor.guideGroupIds];
      if (allowed.length === 0) return null;
      where.push(`c.id_groups IN (${allowed.map(() => '?').join(', ')})`);
      params.push(...allowed);
    } else if (query.groupId) {
      where.push('c.id_groups = ?');
      params.push(query.groupId);
    }
    if (query.academicPeriodId) {
      where.push('c.id_academic_periods = ?');
      params.push(query.academicPeriodId);
    }
    if (query.gradeLevel) {
      where.push('s.grade_level = ?');
      params.push(query.gradeLevel);
    }
    return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
  }

  private toFact(row: Record<string, unknown>): DashboardCaseFact {
    const occurred = row.occurredAt == null ? '' : calendarDateInTimeZone(new Date(String(row.occurredAt)));
    const gradeLevel = row.gradeLevel == null ? null : Number(row.gradeLevel);
    const groupName = String(row.groupName ?? '');
    return {
      id: Number(row.id),
      status: String(row.status) as DisciplinaryCaseStatus,
      severity: String(row.severity) as InfractionSeverity,
      studentUserId: Number(row.studentUserId),
      studentFullName: [row.name, row.firstLastname, row.secondLastname].filter(Boolean).join(' '),
      groupId: Number(row.groupId),
      sectionLabel: gradeLevel != null && groupName ? `${gradeLevel}-${groupName}` : groupName,
      month: occurred.slice(0, 7),
      stepStartedOn: String(row.stepStartedOn ?? '').slice(0, 10),
      stepBusinessDays: Number(row.stepBusinessDays ?? 0),
    };
  }

  private async loadActor(actor: AuthenticatedUser): Promise<DisciplinaryActor> {
    const guides = (await this.dataSource.query(
      `SELECT id_groups AS groupId FROM teaching_assignments WHERE id_users = ? AND is_guide_teacher = 1`,
      [actor.id],
    )) as Array<{ groupId: number }>;
    const roleNames = (actor.roles ?? []).map(String);
    if (roleNames.includes(Role.ADMIN) && !roleNames.includes(INSTITUTIONAL_ROLE_ADMIN)) {
      roleNames.push(INSTITUTIONAL_ROLE_ADMIN);
    }
    return {
      userId: actor.id,
      permissions: actor.permissions ?? [],
      roleNames,
      guideGroupIds: guides.map((guide) => Number(guide.groupId)),
      linkedStudentIds: [],
    };
  }
}
