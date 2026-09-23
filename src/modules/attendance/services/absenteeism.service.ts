import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AbsenteeismAlertStatus } from '../../../common/enums/absenteeism-alert-status.enum';
import { AbsenteeismNotificationChannel } from '../../../common/enums/absenteeism-notification-channel.enum';
import { AbsenteeismRiskLevel } from '../../../common/enums/absenteeism-risk-level.enum';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { Role } from '../../../common/enums/role.enum';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { GroupEnrollment } from '../../administrative/group-enrollments/entities/group-enrollment.entity';
import { TeachingAssignment } from '../../administrative/teaching-assignments/entities/teaching-assignment.entity';
import { User } from '../../administrative/users/entities/user.entity';
import { AbsenteeismAlertNotification } from '../entities/absenteeism-alert-notification.entity';
import { AbsenteeismAlertRule } from '../entities/absenteeism-alert-rule.entity';
import { AbsenteeismAlert } from '../entities/absenteeism-alert.entity';
import { Attendance } from '../entities/attendance.entity';
import {
  DEFAULT_ABSENTEEISM_THRESHOLDS,
  evaluateStudentAbsenteeism,
  monthWindowFor,
  type AbsenteeismRuleThresholds,
  type StudentAbsenteeismMetrics,
  type StudentAttendanceMark,
} from '../utils/absenteeism-rules.util';
import { formatUserFullName } from '../utils/attendance-labels.util';
import { AttendanceSessionsService } from './attendance-sessions.service';

export type AbsenteeismStudentRiskView = {
  studentUserId: number;
  fullName: string;
  nationalId: string;
  group: { id: number; name: string } | null;
  unjustifiedAbsencesMonth: number;
  absencesPeriod: number;
  consecutiveAbsences: number;
  attendancePercent: number;
  lastAbsenceDate: string | null;
  riskLevel: AbsenteeismRiskLevel;
  triggeredRules: string[];
  alertId: number | null;
};

export type AbsenteeismDashboardView = {
  kpis: {
    highRisk: number;
    mediumRisk: number;
    normal: number;
    absencesThisMonth: number;
  };
  riskDistribution: {
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  highRiskStudents: AbsenteeismStudentRiskView[];
  recentAlerts: Array<{
    id: number;
    studentFullName: string;
    riskLevel: AbsenteeismRiskLevel;
    title: string;
    body: string;
    triggeredAt: string;
    readAt: string | null;
  }>;
  criteria: Array<{ code: string; label: string; thresholdValue: number }>;
  trend: Array<{ month: string; high: number; medium: number; low: number }>;
  evaluatedAt: string;
};

@Injectable()
export class AbsenteeismService {
  constructor(
    @InjectRepository(Attendance)
    private readonly attendance: Repository<Attendance>,
    @InjectRepository(AbsenteeismAlert)
    private readonly alerts: Repository<AbsenteeismAlert>,
    @InjectRepository(AbsenteeismAlertRule)
    private readonly rules: Repository<AbsenteeismAlertRule>,
    @InjectRepository(AbsenteeismAlertNotification)
    private readonly notifications: Repository<AbsenteeismAlertNotification>,
    @InjectRepository(TeachingAssignment)
    private readonly teachingAssignments: Repository<TeachingAssignment>,
    @InjectRepository(GroupEnrollment)
    private readonly enrollments: Repository<GroupEnrollment>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly sessionsService: AttendanceSessionsService,
  ) {}

  async getDashboard(actor: AuthenticatedUser): Promise<AbsenteeismDashboardView> {
    this.assertStaffAccess(actor);
    const evaluated = await this.evaluateAndPersist(actor);
    const criteria = await this.listActiveCriteria();
    const recent = await this.listRecentNotifications(actor, 8);
    const trend = await this.buildTrend(actor);

    const highRiskStudents = evaluated
      .filter((s) => s.riskLevel === AbsenteeismRiskLevel.HIGH)
      .sort((a, b) => b.unjustifiedAbsencesMonth - a.unjustifiedAbsencesMonth)
      .slice(0, 10);

    const high = evaluated.filter((s) => s.riskLevel === AbsenteeismRiskLevel.HIGH).length;
    const medium = evaluated.filter((s) => s.riskLevel === AbsenteeismRiskLevel.MEDIUM).length;
    const low = evaluated.filter((s) => s.riskLevel === AbsenteeismRiskLevel.LOW).length;
    const absencesThisMonth = evaluated.reduce(
      (sum, s) => sum + s.unjustifiedAbsencesMonth,
      0,
    );

    return {
      kpis: {
        highRisk: high,
        mediumRisk: medium,
        normal: low,
        absencesThisMonth,
      },
      riskDistribution: {
        high,
        medium,
        low,
        total: evaluated.length,
      },
      highRiskStudents,
      recentAlerts: recent,
      criteria,
      trend,
      evaluatedAt: new Date().toISOString(),
    };
  }

  async listStudents(
    actor: AuthenticatedUser,
    risk?: AbsenteeismRiskLevel,
  ): Promise<AbsenteeismStudentRiskView[]> {
    this.assertStaffAccess(actor);
    const evaluated = await this.evaluateAndPersist(actor);
    if (!risk) return evaluated;
    return evaluated.filter((s) => s.riskLevel === risk);
  }

  async listRules(actor: AuthenticatedUser) {
    this.assertStaffAccess(actor);
    return this.rules.find({ order: { id: 'ASC' } });
  }

  async updateRule(
    actor: AuthenticatedUser,
    ruleId: number,
    patch: { thresholdValue?: number; isActive?: boolean },
  ) {
    if (!this.sessionsService.isAdminActor(actor)) {
      throw new ForbiddenException({
        code: 'ABSENTEEISM_RULES_ADMIN_ONLY',
        message: 'Solo administradores pueden editar reglas de ausentismo',
      });
    }
    const rule = await this.rules.findOne({ where: { id: ruleId } });
    if (!rule) {
      throw new NotFoundException(`Absenteeism rule ${ruleId} not found`);
    }
    if (patch.thresholdValue != null) {
      rule.thresholdValue = patch.thresholdValue;
    }
    if (patch.isActive != null) {
      rule.isActive = patch.isActive;
    }
    return this.rules.save(rule);
  }

  async listAlerts(actor: AuthenticatedUser, limit = 30) {
    this.assertStaffAccess(actor);
    const scopeStudentIds = await this.resolveScopedStudentIds(actor);
    if (scopeStudentIds.length === 0) return [];

    const rows = await this.alerts.find({
      where: { studentUserId: In(scopeStudentIds) },
      relations: { student: true, group: true },
      order: { triggeredAt: 'DESC' },
      take: limit,
    });

    return rows.map((row) => ({
      id: row.id,
      riskLevel: row.riskLevel,
      status: row.status,
      ruleCodes: row.ruleCodes,
      unjustifiedAbsencesMonth: row.unjustifiedAbsencesMonth,
      absencesPeriod: row.absencesPeriod,
      consecutiveAbsences: row.consecutiveAbsences,
      attendancePercent: Number(row.attendancePercent),
      lastAbsenceDate: row.lastAbsenceDate,
      triggeredAt: row.triggeredAt.toISOString(),
      student: {
        id: row.studentUserId,
        fullName: formatUserFullName(row.student),
        nationalId: row.student.national_id,
      },
      group: row.group
        ? { id: row.groupId!, name: row.group.name }
        : null,
    }));
  }

  async markNotificationRead(actor: AuthenticatedUser, notificationId: number) {
    this.assertStaffAccess(actor);
    const row = await this.notifications.findOne({
      where: { id: notificationId },
      relations: { alert: true },
    });
    if (!row) {
      throw new NotFoundException(`Notification ${notificationId} not found`);
    }
    const scope = await this.resolveScopedStudentIds(actor);
    if (!scope.includes(row.alert.studentUserId)) {
      throw new ForbiddenException({
        code: 'ABSENTEEISM_NOTIFICATION_FORBIDDEN',
        message: 'No puede marcar esta notificación',
      });
    }
    row.readAt = new Date();
    await this.notifications.save(row);
    return { id: row.id, readAt: row.readAt.toISOString() };
  }

  private assertStaffAccess(actor: AuthenticatedUser): void {
    if ((actor.roles ?? []).includes(Role.ADMIN)) return;
    if ((actor.permissions ?? []).includes(PERMISSIONS.ATTENDANCE_READ)) return;
    throw new ForbiddenException({
      code: 'ABSENTEEISM_FORBIDDEN',
      message: 'No tiene permiso para consultar alertas de ausentismo',
    });
  }

  private async resolveScopedStudentIds(
    actor: AuthenticatedUser,
  ): Promise<number[]> {
    if (this.sessionsService.isAdminActor(actor)) {
      const rows = await this.enrollments
        .createQueryBuilder('ge')
        .select('DISTINCT ge.id_users', 'studentId')
        .getRawMany<{ studentId: number }>();
      return rows.map((r) => Number(r.studentId)).filter((id) => id > 0);
    }

    const tas = await this.teachingAssignments.find({
      where: { userId: actor.id },
      select: { groupId: true },
    });
    const groupIds = [...new Set(tas.map((t) => t.groupId).filter(Boolean))];
    if (groupIds.length === 0) return [];

    const rows = await this.enrollments
      .createQueryBuilder('ge')
      .select('DISTINCT ge.id_users', 'studentId')
      .where('ge.id_groups IN (:...groupIds)', { groupIds })
      .getRawMany<{ studentId: number }>();
    return rows.map((r) => Number(r.studentId)).filter((id) => id > 0);
  }

  private async loadThresholds(): Promise<AbsenteeismRuleThresholds> {
    const active = await this.rules.find({ where: { isActive: true } });
    const byCode = new Map(active.map((r) => [r.code, r.thresholdValue]));
    return {
      unjustifiedAbsencesMonthHigh:
        byCode.get('UNJUSTIFIED_ABSENCES_MONTH') ??
        DEFAULT_ABSENTEEISM_THRESHOLDS.unjustifiedAbsencesMonthHigh,
      unjustifiedAbsencesMonthMedium:
        byCode.get('MEDIUM_UNJUSTIFIED_ABSENCES_MONTH') ??
        DEFAULT_ABSENTEEISM_THRESHOLDS.unjustifiedAbsencesMonthMedium,
      attendancePercentMin:
        byCode.get('ATTENDANCE_PERCENT_MIN') ??
        DEFAULT_ABSENTEEISM_THRESHOLDS.attendancePercentMin,
      consecutiveAbsencesHigh:
        byCode.get('CONSECUTIVE_ABSENCES') ??
        DEFAULT_ABSENTEEISM_THRESHOLDS.consecutiveAbsencesHigh,
      absencesPeriodHigh:
        byCode.get('ABSENCES_IN_PERIOD') ??
        DEFAULT_ABSENTEEISM_THRESHOLDS.absencesPeriodHigh,
    };
  }

  private async evaluateAndPersist(
    actor: AuthenticatedUser,
  ): Promise<AbsenteeismStudentRiskView[]> {
    const studentIds = await this.resolveScopedStudentIds(actor);
    if (studentIds.length === 0) return [];

    const month = monthWindowFor(new Date());
    const periodStart = new Date();
    periodStart.setMonth(periodStart.getMonth() - 5);
    const periodStartKey = periodStart.toISOString().slice(0, 10);

    const rows = await this.attendance
      .createQueryBuilder('a')
      .innerJoinAndSelect('a.session', 'session')
      .innerJoinAndSelect('session.teachingAssignment', 'ta')
      .leftJoinAndSelect('ta.group', 'grp')
      .innerJoinAndSelect('a.student', 'student')
      .where('a.id_users_student IN (:...studentIds)', { studentIds })
      .andWhere('session.session_date >= :periodStart', {
        periodStart: periodStartKey,
      })
      .getMany();

    const byStudent = new Map<number, typeof rows>();
    for (const row of rows) {
      const list = byStudent.get(row.studentUserId) ?? [];
      list.push(row);
      byStudent.set(row.studentUserId, list);
    }

    // Include enrolled students with zero marks in period as LOW
    for (const id of studentIds) {
      if (!byStudent.has(id)) byStudent.set(id, []);
    }

    const thresholds = await this.loadThresholds();
    const views: AbsenteeismStudentRiskView[] = [];
    const missingStudentIds: number[] = [];

    for (const [studentUserId, marks] of byStudent.entries()) {
      const mappedMarks: StudentAttendanceMark[] = marks.map((m) => ({
        sessionDate: String(m.session.sessionDate).slice(0, 10),
        status: m.status as StudentAttendanceMark['status'],
      }));

      const metrics = evaluateStudentAbsenteeism(
        studentUserId,
        mappedMarks,
        month.start,
        month.end,
        thresholds,
      );

      const sample = marks[0];
      const student = sample?.student;
      const group = sample?.session.teachingAssignment.group ?? null;

      let groupView: { id: number; name: string } | null = group
        ? { id: group.id, name: group.name }
        : null;
      if (!groupView) {
        const enrollment = await this.enrollments.findOne({
          where: { userId: studentUserId },
          relations: { group: true },
          order: { id: 'DESC' },
        });
        if (enrollment?.group) {
          groupView = { id: enrollment.groupId, name: enrollment.group.name };
        }
      }

      const alertId = await this.persistAlert(metrics, groupView?.id ?? null);

      let fullName = student
        ? formatUserFullName(student)
        : `Estudiante #${studentUserId}`;
      let nationalId = student?.national_id ?? '';
      if (!student) {
        missingStudentIds.push(studentUserId);
      }

      views.push({
        studentUserId,
        fullName,
        nationalId,
        group: groupView,
        unjustifiedAbsencesMonth: metrics.unjustifiedAbsencesMonth,
        absencesPeriod: metrics.absencesPeriod,
        consecutiveAbsences: metrics.consecutiveAbsences,
        attendancePercent: metrics.attendancePercent,
        lastAbsenceDate: metrics.lastAbsenceDate,
        riskLevel: metrics.riskLevel,
        triggeredRules: metrics.triggeredRules,
        alertId,
      });
    }

    if (missingStudentIds.length > 0) {
      const users = await this.users.find({
        where: { id: In(missingStudentIds) },
      });
      const byId = new Map(users.map((u) => [u.id, u]));
      for (const view of views) {
        if (view.nationalId) continue;
        const user = byId.get(view.studentUserId);
        if (!user) continue;
        view.fullName = formatUserFullName(user);
        view.nationalId = user.national_id;
      }
    }

    return views.sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
  }

  private async persistAlert(
    metrics: StudentAbsenteeismMetrics,
    groupId: number | null,
  ): Promise<number | null> {
    const month = monthWindowFor(new Date());
    const idempotencyKey = `${metrics.studentUserId}:${month.start}:${metrics.riskLevel}`;

    if (metrics.riskLevel === AbsenteeismRiskLevel.LOW) {
      // Resolve open alerts for this student/month window when back to normal
      const open = await this.alerts.find({
        where: {
          studentUserId: metrics.studentUserId,
          windowStart: month.start,
          status: In([AbsenteeismAlertStatus.NEW, AbsenteeismAlertStatus.ACKNOWLEDGED]),
        },
      });
      for (const row of open) {
        row.status = AbsenteeismAlertStatus.RESOLVED;
        row.resolvedAt = new Date();
        row.riskLevel = AbsenteeismRiskLevel.LOW;
        await this.alerts.save(row);
      }
      return null;
    }

    let alert = await this.alerts.findOne({ where: { idempotencyKey } });
    const isNew = !alert;
    if (!alert) {
      alert = this.alerts.create({
        studentUserId: metrics.studentUserId,
        groupId,
        riskLevel: metrics.riskLevel,
        status: AbsenteeismAlertStatus.NEW,
        ruleCodes: metrics.triggeredRules,
        unjustifiedAbsencesMonth: metrics.unjustifiedAbsencesMonth,
        absencesPeriod: metrics.absencesPeriod,
        consecutiveAbsences: metrics.consecutiveAbsences,
        attendancePercent: metrics.attendancePercent,
        lastAbsenceDate: metrics.lastAbsenceDate,
        windowStart: month.start,
        windowEnd: month.end,
        idempotencyKey,
        triggeredAt: new Date(),
      });
    } else {
      alert.riskLevel = metrics.riskLevel;
      alert.ruleCodes = metrics.triggeredRules;
      alert.unjustifiedAbsencesMonth = metrics.unjustifiedAbsencesMonth;
      alert.absencesPeriod = metrics.absencesPeriod;
      alert.consecutiveAbsences = metrics.consecutiveAbsences;
      alert.attendancePercent = metrics.attendancePercent;
      alert.lastAbsenceDate = metrics.lastAbsenceDate;
      alert.groupId = groupId;
      if (alert.status === AbsenteeismAlertStatus.RESOLVED) {
        alert.status = AbsenteeismAlertStatus.NEW;
        alert.resolvedAt = null;
        alert.triggeredAt = new Date();
      }
    }

    alert = await this.alerts.save(alert);

    if (isNew || alert.status === AbsenteeismAlertStatus.NEW) {
      const existingNotif = await this.notifications.findOne({
        where: {
          alertId: alert.id,
          channel: AbsenteeismNotificationChannel.IN_APP,
        },
      });
      if (!existingNotif) {
        const title =
          metrics.riskLevel === AbsenteeismRiskLevel.HIGH
            ? 'Alerta de ausentismo — riesgo alto'
            : 'Alerta de ausentismo — en observación';
        const body = `${metrics.unjustifiedAbsencesMonth} ausencias injustificadas este mes · ${metrics.attendancePercent}% asistencia`;
        await this.notifications.save(
          this.notifications.create({
            alertId: alert.id,
            channel: AbsenteeismNotificationChannel.IN_APP,
            title,
            body,
            payload: {
              studentUserId: metrics.studentUserId,
              ruleCodes: metrics.triggeredRules,
              riskLevel: metrics.riskLevel,
            },
            sentAt: new Date(),
            readAt: null,
            recipientUserId: null,
          }),
        );
      }
    }

    return alert.id;
  }

  private async listActiveCriteria() {
    const rows = await this.rules.find({
      where: { isActive: true },
      order: { id: 'ASC' },
    });
    return rows
      .filter((r) => r.riskLevel === AbsenteeismRiskLevel.HIGH)
      .map((r) => ({
        code: r.code,
        label: r.label,
        thresholdValue: r.thresholdValue,
      }));
  }

  private async listRecentNotifications(actor: AuthenticatedUser, limit: number) {
    const scope = await this.resolveScopedStudentIds(actor);
    if (scope.length === 0) return [];

    const rows = await this.notifications
      .createQueryBuilder('n')
      .innerJoinAndSelect('n.alert', 'alert')
      .innerJoinAndSelect('alert.student', 'student')
      .where('alert.id_users_student IN (:...scope)', { scope })
      .orderBy('n.sent_at', 'DESC')
      .take(limit)
      .getMany();

    return rows.map((n) => ({
      id: n.id,
      studentFullName: formatUserFullName(n.alert.student),
      riskLevel: n.alert.riskLevel,
      title: n.title,
      body: n.body,
      triggeredAt: n.sentAt.toISOString(),
      readAt: n.readAt ? n.readAt.toISOString() : null,
    }));
  }

  private async buildTrend(actor: AuthenticatedUser) {
    const scope = await this.resolveScopedStudentIds(actor);
    if (scope.length === 0) {
      return Array.from({ length: 6 }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (5 - i));
        return {
          month: d.toISOString().slice(0, 7),
          high: 0,
          medium: 0,
          low: 0,
        };
      });
    }

    const start = new Date();
    start.setMonth(start.getMonth() - 5);
    start.setDate(1);
    const startKey = start.toISOString().slice(0, 10);

    const alerts = await this.alerts.find({
      where: {
        studentUserId: In(scope),
      },
      order: { triggeredAt: 'ASC' },
    });

    const buckets = new Map<string, { high: number; medium: number; low: number }>();
    for (let i = 0; i < 6; i += 1) {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      buckets.set(d.toISOString().slice(0, 7), { high: 0, medium: 0, low: 0 });
    }

    for (const alert of alerts) {
      if (String(alert.windowStart) < startKey) continue;
      const key = String(alert.windowStart).slice(0, 7);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      if (alert.riskLevel === AbsenteeismRiskLevel.HIGH) bucket.high += 1;
      else if (alert.riskLevel === AbsenteeismRiskLevel.MEDIUM) bucket.medium += 1;
      else bucket.low += 1;
    }

    return [...buckets.entries()].map(([month, counts]) => ({
      month,
      ...counts,
    }));
  }
}
