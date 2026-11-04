import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { AttendanceSessionStatus } from '../../../common/enums/attendance-session-status.enum';
import { AttendanceStatus } from '../../../common/enums/attendance-status.enum';
import { JustificationStatus } from '../../../common/enums/justification-status.enum';
import { AcademicPeriod } from '../../administrative/academic-periods/entities/academic-period.entity';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { AttendanceAnalyticsFilterDto } from '../dto/attendance-analytics-filter.dto';
import { Attendance } from '../entities/attendance.entity';
import { AttendanceSession } from '../entities/attendance-session.entity';
import { formatUserFullName } from '../utils/attendance-labels.util';
import { AttendanceSessionsService } from './attendance-sessions.service';
import {
  CRITICAL_ABSENCE_RATE,
  CRITICAL_CONSECUTIVE_ABSENCES,
  STATUS_COUNT_SQL,
  asNumber,
  costaRicaTodayIso,
  presentismoRate,
  roundRate,
} from './attendance-analytics.util';

export type AttendanceStatusCounts = {
  present: number;
  absent: number;
  late: number;
  justified: number;
  total: number;
  attendanceRate: number;
};

export type AttendanceGroupRateView = {
  groupId: number;
  groupName: string;
  totalRecords: number;
  totalPresent: number;
  totalAbsent: number;
  totalLate: number;
  totalJustified: number;
  attendanceRate: number;
};

export type AttendanceTrendPointView = {
  period: string;
  attendanceRate: number;
  present: number;
  absent: number;
  late: number;
  justified: number;
  total: number;
};

export type AttendanceAlertView = {
  studentUserId: number;
  fullName: string;
  nationalId: string;
  groupName: string;
  totalAbsent: number;
  totalRecords: number;
  absenceRate: number;
  consecutiveAbsences: number;
};

export type AttendanceStudentReportRow = {
  studentUserId: number;
  nationalId: string;
  fullName: string;
  groupName: string;
  courseName: string;
  teacherName: string;
  present: number;
  absent: number;
  late: number;
  justified: number;
  total: number;
  attendanceRate: number;
};

export type AttendanceAnalyticsSummaryView = {
  scope: 'institutional' | 'teacher';
  startDate: string | null;
  endDate: string | null;
  totalSessions: number;
  averageAttendanceRate: number;
  totalJustifications: number;
  counts: AttendanceStatusCounts;
  byGroup: AttendanceGroupRateView[];
  trend: AttendanceTrendPointView[];
};

export type AttendanceDashboardKpisView = {
  scope: 'institutional' | 'teacher';
  asOfDate: string;
  criticalAbsenceRate: number;
  today: {
    attendanceRate: number;
    expectedStudents: number;
    registeredStudents: number;
    present: number;
    absent: number;
    late: number;
    justified: number;
  };
  kpis: {
    todayRate: number;
    presentCount: number;
    criticalAbsences: number;
    openSessions: number;
  };
  trend: AttendanceTrendPointView[];
  distribution: AttendanceStatusCounts;
  groupRates: AttendanceGroupRateView[];
  alerts: AttendanceAlertView[];
};

type CountsRaw = {
  present: string | number | null;
  absent: string | number | null;
  late: string | number | null;
  justified: string | number | null;
  total: string | number | null;
  attendanceRate: string | number | null;
};

@Injectable()
export class AttendanceAnalyticsService {
  constructor(
    @InjectRepository(Attendance)
    private readonly attendance: Repository<Attendance>,
    @InjectRepository(AttendanceSession)
    private readonly sessions: Repository<AttendanceSession>,
    @InjectRepository(AcademicPeriod)
    private readonly periods: Repository<AcademicPeriod>,
    private readonly sessionsService: AttendanceSessionsService,
    private readonly dataSource: DataSource,
  ) {}

  async getSummary(
    filters: AttendanceAnalyticsFilterDto,
    actor: AuthenticatedUser,
  ): Promise<AttendanceAnalyticsSummaryView> {
    const resolved = await this.resolveDateWindow(filters);
    const scoped = { ...filters, startDate: resolved.startDate, endDate: resolved.endDate };
    const [counts, byGroup, trend, totalSessions, approvedJustifications] =
      await Promise.all([
        this.queryStatusCounts(scoped, actor),
        this.queryGroupRates(scoped, actor),
        this.queryTrend(scoped, actor, 'month'),
        this.querySessionCount(scoped, actor),
        this.queryApprovedJustifications(scoped, actor),
      ]);

    return {
      scope: this.sessionsService.isAdminActor(actor) ? 'institutional' : 'teacher',
      startDate: resolved.startDate ?? null,
      endDate: resolved.endDate ?? null,
      totalSessions,
      averageAttendanceRate: counts.attendanceRate,
      totalJustifications: Math.max(approvedJustifications, counts.justified),
      counts,
      byGroup,
      trend,
    };
  }

  async getDashboardKpis(
    filters: AttendanceAnalyticsFilterDto,
    actor: AuthenticatedUser,
  ): Promise<AttendanceDashboardKpisView> {
    const asOfDate = costaRicaTodayIso();
    const resolved = await this.resolveDateWindow(filters, asOfDate);
    const scoped = { ...filters, startDate: resolved.startDate, endDate: resolved.endDate };
    const todayFilters: AttendanceAnalyticsFilterDto = {
      ...filters,
      startDate: asOfDate,
      endDate: asOfDate,
      academicPeriodId: undefined,
    };

    const [todayCounts, expected, registered, distribution, trend, groupRates, alerts, openSessions] =
      await Promise.all([
        this.queryStatusCounts(todayFilters, actor),
        this.queryExpectedStudentsToday(asOfDate, actor, filters),
        this.queryRegisteredStudentsToday(asOfDate, actor, filters),
        this.queryStatusCounts(scoped, actor),
        this.queryTrend(scoped, actor, 'week'),
        this.queryGroupRates(scoped, actor),
        this.queryAlerts(scoped, actor),
        this.queryOpenSessions(actor, filters),
      ]);

    const todayRate = presentismoRate(
      todayCounts.present,
      todayCounts.late,
      Math.max(todayCounts.total, expected),
    );

    return {
      scope: this.sessionsService.isAdminActor(actor) ? 'institutional' : 'teacher',
      asOfDate,
      criticalAbsenceRate: CRITICAL_ABSENCE_RATE,
      today: {
        attendanceRate: todayRate,
        expectedStudents: expected,
        registeredStudents: registered,
        present: todayCounts.present,
        absent: todayCounts.absent,
        late: todayCounts.late,
        justified: todayCounts.justified,
      },
      kpis: {
        todayRate,
        presentCount: todayCounts.present + todayCounts.late,
        criticalAbsences: alerts.length,
        openSessions,
      },
      trend,
      distribution,
      groupRates,
      alerts,
    };
  }

  async getStudentReportRows(
    filters: AttendanceAnalyticsFilterDto,
    actor: AuthenticatedUser,
  ): Promise<AttendanceStudentReportRow[]> {
    const resolved = await this.resolveDateWindow(filters);
    const scoped = { ...filters, startDate: resolved.startDate, endDate: resolved.endDate };
    const qb = this.baseQb(actor, scoped)
      .select('student.id', 'studentUserId')
      .addSelect('student.national_id', 'nationalId')
      .addSelect('student.name', 'name')
      .addSelect('student.first_lastname', 'firstLastname')
      .addSelect('student.second_lastname', 'secondLastname')
      .addSelect('grp.name', 'groupName')
      .addSelect(
        "COALESCE(subject.name, specialty.name, '—')",
        'courseName',
      )
      .addSelect('teacher.name', 'teacherName')
      .addSelect('teacher.first_lastname', 'teacherFirst')
      .addSelect('teacher.second_lastname', 'teacherSecond')
      .leftJoin('ta.user', 'teacher')
      .addSelect(STATUS_COUNT_SQL.present, 'present')
      .addSelect(STATUS_COUNT_SQL.absent, 'absent')
      .addSelect(STATUS_COUNT_SQL.late, 'late')
      .addSelect(STATUS_COUNT_SQL.justified, 'justified')
      .addSelect('COUNT(a.id_attendance)', 'total')
      .addSelect(STATUS_COUNT_SQL.presentismo, 'attendanceRate')
      .groupBy('student.id')
      .addGroupBy('student.national_id')
      .addGroupBy('student.name')
      .addGroupBy('student.first_lastname')
      .addGroupBy('student.second_lastname')
      .addGroupBy('grp.name')
      .addGroupBy('subject.name')
      .addGroupBy('specialty.name')
      .addGroupBy('teacher.name')
      .addGroupBy('teacher.first_lastname')
      .addGroupBy('teacher.second_lastname')
      .orderBy('grp.name', 'ASC')
      .addOrderBy('student.first_lastname', 'ASC')
      .addOrderBy('student.name', 'ASC');

    const rows = await qb.getRawMany<Record<string, unknown>>();
    return rows.map((row) => {
      const present = asNumber(row.present);
      const absent = asNumber(row.absent);
      const late = asNumber(row.late);
      const justified = asNumber(row.justified);
      const total = asNumber(row.total);
      return {
        studentUserId: asNumber(row.studentUserId),
        nationalId: String(row.nationalId ?? ''),
        fullName: formatUserFullName({
          name: String(row.name ?? ''),
          first_lastname: String(row.firstLastname ?? ''),
          second_lastname: row.secondLastname == null ? null : String(row.secondLastname),
        }),
        groupName: String(row.groupName ?? '—'),
        courseName: String(row.courseName ?? '—'),
        teacherName: formatUserFullName({
          name: String(row.teacherName ?? ''),
          first_lastname: String(row.teacherFirst ?? ''),
          second_lastname: row.teacherSecond == null ? null : String(row.teacherSecond),
        }),
        present,
        absent,
        late,
        justified,
        total,
        attendanceRate: roundRate(asNumber(row.attendanceRate) || presentismoRate(present, late, total)),
      };
    });
  }

  private async resolveDateWindow(
    filters: AttendanceAnalyticsFilterDto,
    fallbackEnd: string = costaRicaTodayIso(),
  ): Promise<{ startDate?: string; endDate?: string }> {
    let startDate = filters.startDate?.slice(0, 10);
    let endDate = filters.endDate?.slice(0, 10);

    if (filters.academicPeriodId != null) {
      const period = await this.periods.findOne({
        where: { id: filters.academicPeriodId },
      });
      if (period) {
        if (!startDate) startDate = String(period.startDate).slice(0, 10);
        if (!endDate) endDate = String(period.endDate).slice(0, 10);
      }
    }

    if (!startDate && !endDate) {
      const end = new Date(`${fallbackEnd}T12:00:00`);
      const start = new Date(end);
      start.setDate(start.getDate() - 89);
      startDate = start.toISOString().slice(0, 10);
      endDate = fallbackEnd;
    }

    return { startDate, endDate };
  }

  private baseQb(
    actor: AuthenticatedUser,
    filters: AttendanceAnalyticsFilterDto,
  ): SelectQueryBuilder<Attendance> {
    const qb = this.attendance
      .createQueryBuilder('a')
      .innerJoin('a.session', 'session')
      .innerJoin('session.teachingAssignment', 'ta')
      .innerJoin('ta.group', 'grp')
      .innerJoin('a.student', 'student')
      .leftJoin('ta.subject', 'subject')
      .leftJoin('ta.specialty', 'specialty');

    if (!this.sessionsService.isAdminActor(actor)) {
      qb.andWhere('ta.id_users = :teacherId', { teacherId: actor.id });
    }

    this.applyFilters(qb, filters);
    return qb;
  }

  private applyFilters(
    qb: SelectQueryBuilder<Attendance>,
    filters: AttendanceAnalyticsFilterDto,
  ): void {
    if (filters.startDate) {
      qb.andWhere('session.session_date >= :startDate', {
        startDate: filters.startDate.slice(0, 10),
      });
    }
    if (filters.endDate) {
      qb.andWhere('session.session_date <= :endDate', {
        endDate: filters.endDate.slice(0, 10),
      });
    }
    if (filters.groupId != null) {
      qb.andWhere('ta.id_groups = :groupId', { groupId: filters.groupId });
    }
    if (filters.courseId != null) {
      qb.andWhere('ta.id_subjects = :courseId', { courseId: filters.courseId });
    }
    if (filters.teachingAssignmentId != null) {
      qb.andWhere('ta.id_teaching_assignments = :taId', {
        taId: filters.teachingAssignmentId,
      });
    }
    if (filters.status) {
      qb.andWhere('a.status = :status', { status: filters.status });
    }
  }

  private mapCounts(raw: CountsRaw | undefined): AttendanceStatusCounts {
    const present = asNumber(raw?.present);
    const absent = asNumber(raw?.absent);
    const late = asNumber(raw?.late);
    const justified = asNumber(raw?.justified);
    const total = asNumber(raw?.total);
    return {
      present,
      absent,
      late,
      justified,
      total,
      attendanceRate: roundRate(
        asNumber(raw?.attendanceRate) || presentismoRate(present, late, total),
      ),
    };
  }

  private async queryStatusCounts(
    filters: AttendanceAnalyticsFilterDto,
    actor: AuthenticatedUser,
  ): Promise<AttendanceStatusCounts> {
    const raw = await this.baseQb(actor, filters)
      .select(STATUS_COUNT_SQL.present, 'present')
      .addSelect(STATUS_COUNT_SQL.absent, 'absent')
      .addSelect(STATUS_COUNT_SQL.late, 'late')
      .addSelect(STATUS_COUNT_SQL.justified, 'justified')
      .addSelect('COUNT(a.id_attendance)', 'total')
      .addSelect(STATUS_COUNT_SQL.presentismo, 'attendanceRate')
      .getRawOne<CountsRaw>();
    return this.mapCounts(raw);
  }

  private async queryGroupRates(
    filters: AttendanceAnalyticsFilterDto,
    actor: AuthenticatedUser,
  ): Promise<AttendanceGroupRateView[]> {
    const rows = await this.baseQb(actor, filters)
      .select('grp.id', 'groupId')
      .addSelect('grp.name', 'groupName')
      .addSelect('COUNT(a.id_attendance)', 'totalRecords')
      .addSelect(STATUS_COUNT_SQL.present, 'totalPresent')
      .addSelect(STATUS_COUNT_SQL.absent, 'totalAbsent')
      .addSelect(STATUS_COUNT_SQL.late, 'totalLate')
      .addSelect(STATUS_COUNT_SQL.justified, 'totalJustified')
      .addSelect(STATUS_COUNT_SQL.presentismo, 'attendanceRate')
      .groupBy('grp.id')
      .addGroupBy('grp.name')
      .orderBy('grp.name', 'ASC')
      .getRawMany<Record<string, unknown>>();

    return rows.map((row) => {
      const totalPresent = asNumber(row.totalPresent);
      const totalLate = asNumber(row.totalLate);
      const totalRecords = asNumber(row.totalRecords);
      return {
        groupId: asNumber(row.groupId),
        groupName: String(row.groupName ?? ''),
        totalRecords,
        totalPresent,
        totalAbsent: asNumber(row.totalAbsent),
        totalLate,
        totalJustified: asNumber(row.totalJustified),
        attendanceRate: roundRate(
          asNumber(row.attendanceRate) ||
            presentismoRate(totalPresent, totalLate, totalRecords),
        ),
      };
    });
  }

  private async queryTrend(
    filters: AttendanceAnalyticsFilterDto,
    actor: AuthenticatedUser,
    grain: 'week' | 'month',
  ): Promise<AttendanceTrendPointView[]> {
    const periodExpr =
      grain === 'month'
        ? "DATE_FORMAT(session.session_date, '%Y-%m')"
        : "DATE_FORMAT(session.session_date, '%x-W%v')";

    const rows = await this.baseQb(actor, filters)
      .select(periodExpr, 'period')
      .addSelect(STATUS_COUNT_SQL.present, 'present')
      .addSelect(STATUS_COUNT_SQL.absent, 'absent')
      .addSelect(STATUS_COUNT_SQL.late, 'late')
      .addSelect(STATUS_COUNT_SQL.justified, 'justified')
      .addSelect('COUNT(a.id_attendance)', 'total')
      .addSelect(STATUS_COUNT_SQL.presentismo, 'attendanceRate')
      .groupBy('period')
      .orderBy('period', 'ASC')
      .getRawMany<Record<string, unknown>>();

    return rows.map((row) => {
      const present = asNumber(row.present);
      const late = asNumber(row.late);
      const total = asNumber(row.total);
      return {
        period: String(row.period ?? ''),
        present,
        absent: asNumber(row.absent),
        late,
        justified: asNumber(row.justified),
        total,
        attendanceRate: roundRate(
          asNumber(row.attendanceRate) || presentismoRate(present, late, total),
        ),
      };
    });
  }

  private async querySessionCount(
    filters: AttendanceAnalyticsFilterDto,
    actor: AuthenticatedUser,
  ): Promise<number> {
    const qb = this.sessions
      .createQueryBuilder('session')
      .innerJoin('session.teachingAssignment', 'ta');

    if (!this.sessionsService.isAdminActor(actor)) {
      qb.andWhere('ta.id_users = :teacherId', { teacherId: actor.id });
    }
    if (filters.startDate) {
      qb.andWhere('session.session_date >= :startDate', {
        startDate: filters.startDate.slice(0, 10),
      });
    }
    if (filters.endDate) {
      qb.andWhere('session.session_date <= :endDate', {
        endDate: filters.endDate.slice(0, 10),
      });
    }
    if (filters.groupId != null) {
      qb.andWhere('ta.id_groups = :groupId', { groupId: filters.groupId });
    }
    if (filters.courseId != null) {
      qb.andWhere('ta.id_subjects = :courseId', { courseId: filters.courseId });
    }
    if (filters.teachingAssignmentId != null) {
      qb.andWhere('ta.id_teaching_assignments = :taId', {
        taId: filters.teachingAssignmentId,
      });
    }

    return qb.getCount();
  }

  private async queryApprovedJustifications(
    filters: AttendanceAnalyticsFilterDto,
    actor: AuthenticatedUser,
  ): Promise<number> {
    try {
      const qb = this.baseQb(actor, filters)
        .innerJoin('a.justifications', 'j')
        .select('COUNT(DISTINCT j.id_absence_justifications)', 'total')
        .andWhere('j.status = :justStatus', {
          justStatus: JustificationStatus.APPROVED,
        });
      const raw = await qb.getRawOne<{ total: string | number | null }>();
      return asNumber(raw?.total);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/absence_justifications/i.test(message) && /doesn't exist/i.test(message)) {
        return 0;
      }
      throw error;
    }
  }

  private async queryOpenSessions(
    actor: AuthenticatedUser,
    filters: AttendanceAnalyticsFilterDto,
  ): Promise<number> {
    const qb = this.sessions
      .createQueryBuilder('session')
      .innerJoin('session.teachingAssignment', 'ta')
      .where('session.status = :open', { open: AttendanceSessionStatus.OPEN });

    if (!this.sessionsService.isAdminActor(actor)) {
      qb.andWhere('ta.id_users = :teacherId', { teacherId: actor.id });
    }
    if (filters.groupId != null) {
      qb.andWhere('ta.id_groups = :groupId', { groupId: filters.groupId });
    }
    if (filters.courseId != null) {
      qb.andWhere('ta.id_subjects = :courseId', { courseId: filters.courseId });
    }
    return qb.getCount();
  }

  private async queryExpectedStudentsToday(
    today: string,
    actor: AuthenticatedUser,
    filters: AttendanceAnalyticsFilterDto,
  ): Promise<number> {
    const params: Array<string | number> = [today, today, today];
    let sql = `
      SELECT COUNT(DISTINCT ge.id_users) AS total
      FROM attendance_sessions session
      INNER JOIN teaching_assignments ta
        ON ta.id_teaching_assignments = session.id_teaching_assignments
      INNER JOIN group_enrollments ge
        ON ge.id_groups = ta.id_groups
       AND ge.starts_on <= ?
       AND (ge.ends_on IS NULL OR ge.ends_on >= ?)
      WHERE session.session_date = ?
    `;
    if (!this.sessionsService.isAdminActor(actor)) {
      sql += ' AND ta.id_users = ?';
      params.push(actor.id);
    }
    if (filters.groupId != null) {
      sql += ' AND ta.id_groups = ?';
      params.push(filters.groupId);
    }
    if (filters.courseId != null) {
      sql += ' AND ta.id_subjects = ?';
      params.push(filters.courseId);
    }
    const rows = await this.dataSource.query(sql, params);
    return asNumber((rows as Array<{ total: unknown }>)[0]?.total);
  }

  private async queryRegisteredStudentsToday(
    today: string,
    actor: AuthenticatedUser,
    filters: AttendanceAnalyticsFilterDto,
  ): Promise<number> {
    const raw = await this.baseQb(actor, {
      ...filters,
      startDate: today,
      endDate: today,
      academicPeriodId: undefined,
    })
      .select('COUNT(DISTINCT a.id_users_student)', 'total')
      .getRawOne<{ total: string | number | null }>();
    return asNumber(raw?.total);
  }

  private async queryAlerts(
    filters: AttendanceAnalyticsFilterDto,
    actor: AuthenticatedUser,
  ): Promise<AttendanceAlertView[]> {
    const rateRows = await this.baseQb(actor, filters)
      .select('student.id', 'studentUserId')
      .addSelect('student.national_id', 'nationalId')
      .addSelect('student.name', 'name')
      .addSelect('student.first_lastname', 'firstLastname')
      .addSelect('student.second_lastname', 'secondLastname')
      .addSelect('grp.name', 'groupName')
      .addSelect(STATUS_COUNT_SQL.absent, 'totalAbsent')
      .addSelect('COUNT(a.id_attendance)', 'totalRecords')
      .addSelect(
        `ROUND((${STATUS_COUNT_SQL.absent} / NULLIF(COUNT(a.id_attendance), 0)) * 100, 2)`,
        'absenceRate',
      )
      .groupBy('student.id')
      .addGroupBy('student.national_id')
      .addGroupBy('student.name')
      .addGroupBy('student.first_lastname')
      .addGroupBy('student.second_lastname')
      .addGroupBy('grp.name')
      .having(`${STATUS_COUNT_SQL.absent} > 0`)
      .orderBy('absenceRate', 'DESC')
      .addOrderBy('totalAbsent', 'DESC')
      .take(40)
      .getRawMany<Record<string, unknown>>();

    const consecutive = await this.queryConsecutiveAbsences(filters, actor);
    const merged = rateRows.map((row) => {
      const studentUserId = asNumber(row.studentUserId);
      return {
        studentUserId,
        nationalId: String(row.nationalId ?? ''),
        fullName: formatUserFullName({
          name: String(row.name ?? ''),
          first_lastname: String(row.firstLastname ?? ''),
          second_lastname: row.secondLastname == null ? null : String(row.secondLastname),
        }),
        groupName: String(row.groupName ?? '—'),
        totalAbsent: asNumber(row.totalAbsent),
        totalRecords: asNumber(row.totalRecords),
        absenceRate: roundRate(asNumber(row.absenceRate)),
        consecutiveAbsences: consecutive.get(studentUserId) ?? 0,
      };
    });

    return merged
      .filter(
        (row) =>
          row.absenceRate >= CRITICAL_ABSENCE_RATE ||
          row.consecutiveAbsences >= CRITICAL_CONSECUTIVE_ABSENCES ||
          row.totalAbsent >= CRITICAL_CONSECUTIVE_ABSENCES,
      )
      .sort((a, b) => {
        if (b.consecutiveAbsences !== a.consecutiveAbsences) {
          return b.consecutiveAbsences - a.consecutiveAbsences;
        }
        return b.absenceRate - a.absenceRate;
      })
      .slice(0, 10);
  }

  private async queryConsecutiveAbsences(
    filters: AttendanceAnalyticsFilterDto,
    actor: AuthenticatedUser,
  ): Promise<Map<number, number>> {
    const params: Array<string | number> = [];
    let sql = `
      SELECT studentId, MAX(streak) AS consecutiveAbsences
      FROM (
        SELECT studentId, grp, COUNT(*) AS streak
        FROM (
          SELECT
            a.id_users_student AS studentId,
            a.status AS status,
            SUM(CASE WHEN a.status = ? THEN 0 ELSE 1 END) OVER (
              PARTITION BY a.id_users_student
              ORDER BY session.session_date, a.id_attendance
            ) AS grp
          FROM attendance a
          INNER JOIN attendance_sessions session
            ON session.id_attendance_sessions = a.id_attendance_sessions
          INNER JOIN teaching_assignments ta
            ON ta.id_teaching_assignments = session.id_teaching_assignments
          WHERE 1 = 1
    `;
    params.push(AttendanceStatus.ABSENT);

    if (!this.sessionsService.isAdminActor(actor)) {
      sql += ' AND ta.id_users = ?';
      params.push(actor.id);
    }
    if (filters.startDate) {
      sql += ' AND session.session_date >= ?';
      params.push(filters.startDate.slice(0, 10));
    }
    if (filters.endDate) {
      sql += ' AND session.session_date <= ?';
      params.push(filters.endDate.slice(0, 10));
    }
    if (filters.groupId != null) {
      sql += ' AND ta.id_groups = ?';
      params.push(filters.groupId);
    }
    if (filters.courseId != null) {
      sql += ' AND ta.id_subjects = ?';
      params.push(filters.courseId);
    }
    if (filters.teachingAssignmentId != null) {
      sql += ' AND ta.id_teaching_assignments = ?';
      params.push(filters.teachingAssignmentId);
    }

    sql += `
        ) marked
        WHERE status = ?
        GROUP BY studentId, grp
      ) streaks
      GROUP BY studentId
    `;
    params.push(AttendanceStatus.ABSENT);

    const rows = (await this.dataSource.query(sql, params)) as Array<{
      studentId: unknown;
      consecutiveAbsences: unknown;
    }>;
    const map = new Map<number, number>();
    for (const row of rows) {
      map.set(asNumber(row.studentId), asNumber(row.consecutiveAbsences));
    }
    return map;
  }
}
