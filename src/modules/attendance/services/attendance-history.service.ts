import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { AcademicOfferingKind } from '../../../common/enums/academic-offering-kind.enum';
import { AttendanceRegistrationMethod } from '../../../common/enums/attendance-registration-method.enum';
import { AttendanceStatus } from '../../../common/enums/attendance-status.enum';
import { ScheduleSlotType } from '../../../common/enums/schedule-slot-type.enum';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { ScheduleTimeSlot } from '../../schedule/entities/schedule-time-slot.entity';
import {
  AttendanceHistoryFilterDto,
  AttendanceHistorySortBy,
} from '../dto/attendance-history-filter.dto';
import { Attendance } from '../entities/attendance.entity';
import {
  hasAttendanceHistoryAccess,
  isOwnHistoryOnlyActor,
} from '../utils/attendance-actor.util';
import {
  formatUserFullName,
  offeringKindLabel,
} from '../utils/attendance-labels.util';
import { AttendanceSessionsService } from './attendance-sessions.service';

export type AttendanceHistoryItemView = {
  attendanceId: number;
  sessionId: number;
  sessionDate: string;
  startedAt: Date;
  registeredAt: Date;
  status: AttendanceStatus;
  registrationMethod: AttendanceRegistrationMethod;
  group: { id: number; name: string; gradeLevel: number | null };
  offering: {
    kind: AcademicOfferingKind | null;
    id: number | null;
    name: string;
    labelKind: string;
  };
  teacher: { id: number; fullName: string };
  student: { id: number; nationalId: string; fullName: string };
  teachingAssignmentId: number;
  lessonNumber: number | null;
  lessonTotal: number | null;
  scheduleStartTime: string | null;
  scheduleEndTime: string | null;
  registeredBy: { id: number | null; fullName: string };
  lateMinutes: number | null;
};

export type AttendanceHistoryPageView = {
  items: AttendanceHistoryItemView[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type AttendanceHistorySummaryView = {
  total: number;
  present: number;
  late: number;
  absent: number;
  justified: number;
  attendancePercent: number;
  band: 'Excelente' | 'Bueno' | 'Regular' | 'En riesgo' | 'Sin datos';
};

@Injectable()
export class AttendanceHistoryService {
  constructor(
    @InjectRepository(Attendance)
    private readonly attendance: Repository<Attendance>,
    @InjectRepository(ScheduleTimeSlot)
    private readonly timeSlots: Repository<ScheduleTimeSlot>,
    private readonly sessionsService: AttendanceSessionsService,
  ) {}

  async search(
    filters: AttendanceHistoryFilterDto,
    actor: AuthenticatedUser,
  ): Promise<AttendanceHistoryPageView> {
    this.assertHistoryAccess(actor);

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 25;
    const sortBy: AttendanceHistorySortBy = filters.sortBy ?? 'sessionDate';
    const sortOrder = filters.sortOrder ?? 'DESC';

    const qb = this.createBaseQuery(actor, filters);
    this.applySort(qb, sortBy, sortOrder);

    const total = await qb.clone().getCount();
    const rows = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    const lessonTotal = await this.countClassLessons();
    const items = rows.map((row) => this.toItem(row, lessonTotal));
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return { items, total, page, limit, totalPages };
  }

  async summarize(
    filters: AttendanceHistoryFilterDto,
    actor: AuthenticatedUser,
  ): Promise<AttendanceHistorySummaryView> {
    this.assertHistoryAccess(actor);

    const qb = this.attendance
      .createQueryBuilder('a')
      .innerJoin('a.session', 'session')
      .innerJoin('session.teachingAssignment', 'ta')
      .innerJoin('a.student', 'student');

    this.applyActorScope(qb, actor, filters);
    this.applyFilters(qb, filters, actor);

    const rows = await qb
      .select('a.status', 'status')
      .addSelect('COUNT(DISTINCT a.id_attendance)', 'count')
      .groupBy('a.status')
      .getRawMany<{ status: AttendanceStatus; count: string }>();

    const counts: Record<AttendanceStatus, number> = {
      [AttendanceStatus.PRESENT]: 0,
      [AttendanceStatus.LATE]: 0,
      [AttendanceStatus.ABSENT]: 0,
      [AttendanceStatus.JUSTIFIED]: 0,
    };

    for (const row of rows) {
      const status = row.status;
      if (status in counts) {
        counts[status] = Number(row.count) || 0;
      }
    }

    const total =
      counts.PRESENT + counts.LATE + counts.ABSENT + counts.JUSTIFIED;
    const attended = counts.PRESENT + counts.LATE + counts.JUSTIFIED;
    const attendancePercent =
      total === 0 ? 0 : Math.round((attended / total) * 1000) / 10;

    return {
      total,
      present: counts.PRESENT,
      late: counts.LATE,
      absent: counts.ABSENT,
      justified: counts.JUSTIFIED,
      attendancePercent,
      band: this.bandForPercent(attendancePercent, total),
    };
  }

  /** Unpaginated items for filtered history export (hard cap). */
  async listForExport(
    filters: AttendanceHistoryFilterDto,
    actor: AuthenticatedUser,
    maxRows = 5000,
  ): Promise<AttendanceHistoryItemView[]> {
    this.assertHistoryAccess(actor);
    const qb = this.createBaseQuery(actor, filters);
    this.applySort(qb, filters.sortBy ?? 'sessionDate', filters.sortOrder ?? 'DESC');
    const rows = await qb.take(maxRows).getMany();
    const lessonTotal = await this.countClassLessons();
    return rows.map((row) => this.toItem(row, lessonTotal));
  }

  private assertHistoryAccess(actor: AuthenticatedUser): void {
    if (!hasAttendanceHistoryAccess(actor)) {
      throw new ForbiddenException({
        code: 'ATTENDANCE_HISTORY_FORBIDDEN',
        message: 'No tiene permiso para consultar el historial de asistencia',
      });
    }
  }

  private createBaseQuery(
    actor: AuthenticatedUser,
    filters: AttendanceHistoryFilterDto,
  ): SelectQueryBuilder<Attendance> {
    const qb = this.attendance
      .createQueryBuilder('a')
      .innerJoinAndSelect('a.session', 'session')
      .innerJoinAndSelect('session.teachingAssignment', 'ta')
      .leftJoinAndSelect('ta.group', 'grp')
      .leftJoinAndSelect('grp.section', 'section')
      .leftJoinAndSelect('ta.subject', 'subject')
      .leftJoinAndSelect('ta.specialty', 'specialty')
      .leftJoinAndSelect('ta.user', 'teacher')
      .innerJoinAndSelect('a.student', 'student')
      .leftJoinAndSelect('a.registeredBy', 'registeredBy')
      .leftJoinAndSelect('session.scheduleEntry', 'scheduleEntry')
      .leftJoinAndSelect('scheduleEntry.timeSlot', 'timeSlot');

    this.applyActorScope(qb, actor, filters);
    this.applyFilters(qb, filters, actor);
    return qb;
  }

  private applyActorScope(
    qb: SelectQueryBuilder<Attendance>,
    actor: AuthenticatedUser,
    filters: AttendanceHistoryFilterDto,
  ): void {
    if (this.sessionsService.isAdminActor(actor)) {
      return;
    }

    if (isOwnHistoryOnlyActor(actor)) {
      qb.andWhere('a.id_users_student = :ownStudentId', {
        ownStudentId: actor.id,
      });
      return;
    }

    // Teachers / staff with attendance.view → own teaching assignments
    qb.andWhere('ta.id_users = :teacherId', { teacherId: actor.id });
  }

  private applyFilters(
    qb: SelectQueryBuilder<Attendance>,
    filters: AttendanceHistoryFilterDto,
    actor: AuthenticatedUser,
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
    if (filters.teachingAssignmentId != null) {
      qb.andWhere('ta.id_teaching_assignments = :taId', {
        taId: filters.teachingAssignmentId,
      });
    }

    // Students cannot query another student's id
    if (isOwnHistoryOnlyActor(actor)) {
      // already scoped; ignore client studentId
    } else if (filters.studentId != null) {
      qb.andWhere('a.id_users_student = :studentId', {
        studentId: filters.studentId,
      });
    }

    if (filters.status) {
      qb.andWhere('a.status = :status', { status: filters.status });
    }
    if (filters.registrationMethod) {
      qb.andWhere('a.registration_method = :registrationMethod', {
        registrationMethod: filters.registrationMethod,
      });
    }
    if (filters.search && !isOwnHistoryOnlyActor(actor)) {
      const term = `%${filters.search.toLowerCase()}%`;
      qb.andWhere(
        `(
          LOWER(student.name) LIKE :term
          OR LOWER(student.first_lastname) LIKE :term
          OR LOWER(IFNULL(student.second_lastname, '')) LIKE :term
          OR LOWER(student.national_id) LIKE :term
          OR LOWER(CONCAT(student.name, ' ', student.first_lastname, ' ', IFNULL(student.second_lastname, ''))) LIKE :term
        )`,
        { term },
      );
    }
  }

  private applySort(
    qb: SelectQueryBuilder<Attendance>,
    sortBy: AttendanceHistorySortBy,
    sortOrder: 'ASC' | 'DESC',
  ): void {
    switch (sortBy) {
      case 'registeredAt':
        qb.orderBy('a.registered_at', sortOrder);
        break;
      case 'studentName':
        qb.orderBy('student.first_lastname', sortOrder).addOrderBy(
          'student.name',
          sortOrder,
        );
        break;
      case 'status':
        qb.orderBy('a.status', sortOrder);
        break;
      case 'sessionDate':
      default:
        qb.orderBy('session.session_date', sortOrder).addOrderBy(
          'session.started_at',
          sortOrder,
        );
        break;
    }
    qb.addOrderBy('a.id_attendance', 'DESC');
  }

  private async countClassLessons(): Promise<number | null> {
    const count = await this.timeSlots.count({
      where: { slotType: ScheduleSlotType.CLASS, isActive: true },
    });
    return count > 0 ? count : null;
  }

  private toItem(
    row: Attendance,
    lessonTotal: number | null,
  ): AttendanceHistoryItemView {
    const session = row.session;
    const ta = session.teachingAssignment;
    const teacher = ta.user;
    const student = row.student;
    const slot = session.scheduleEntry?.timeSlot ?? null;

    let offeringKind: AcademicOfferingKind | null = ta.offeringKind ?? null;
    let offeringId: number | null = null;
    let offeringName = '—';
    if (offeringKind === AcademicOfferingKind.SUBJECT) {
      offeringId = ta.subjectId ?? null;
      offeringName = ta.subject?.name ?? '—';
    } else if (offeringKind) {
      offeringId = ta.specialtyId ?? null;
      offeringName = ta.specialty?.name ?? '—';
    }

    const isToken =
      row.registrationMethod === AttendanceRegistrationMethod.TOKEN;
    const registeredByUser = row.registeredBy;
    const registeredByName = isToken
      ? 'Sistema'
      : registeredByUser
        ? formatUserFullName(registeredByUser)
        : teacher
          ? formatUserFullName(teacher)
          : '—';

    return {
      attendanceId: row.id,
      sessionId: session.id,
      sessionDate: String(session.sessionDate).slice(0, 10),
      startedAt: session.startedAt,
      registeredAt: row.registeredAt,
      status: row.status,
      registrationMethod: row.registrationMethod,
      group: {
        id: ta.groupId,
        name: ta.group?.name ?? '—',
        gradeLevel: ta.group?.section?.gradeLevel ?? null,
      },
      offering: {
        kind: offeringKind,
        id: offeringId,
        name: offeringName,
        labelKind: offeringKind ? offeringKindLabel(offeringKind) : '—',
      },
      teacher: {
        id: ta.userId,
        fullName: teacher ? formatUserFullName(teacher) : '—',
      },
      student: {
        id: student.id,
        nationalId: student.national_id,
        fullName: formatUserFullName(student),
      },
      teachingAssignmentId: ta.id,
      lessonNumber: slot?.lessonNumber ?? null,
      lessonTotal,
      scheduleStartTime: slot?.startTime ? String(slot.startTime).slice(0, 5) : null,
      scheduleEndTime: slot?.endTime ? String(slot.endTime).slice(0, 5) : null,
      registeredBy: {
        id: isToken ? null : (registeredByUser?.id ?? ta.userId),
        fullName: registeredByName,
      },
      lateMinutes: this.computeLateMinutes(row, slot?.startTime ?? null),
    };
  }

  private computeLateMinutes(
    row: Attendance,
    startTime: string | null,
  ): number | null {
    if (row.status !== AttendanceStatus.LATE || !startTime) return null;
    const sessionDate = String(row.session.sessionDate).slice(0, 10);
    const start = new Date(`${sessionDate}T${String(startTime).slice(0, 8)}`);
    const registered = new Date(row.registeredAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(registered.getTime())) {
      return null;
    }
    const diff = Math.round((registered.getTime() - start.getTime()) / 60000);
    return diff > 0 ? diff : null;
  }

  private bandForPercent(
    percent: number,
    total: number,
  ): AttendanceHistorySummaryView['band'] {
    if (total === 0) return 'Sin datos';
    if (percent >= 90) return 'Excelente';
    if (percent >= 80) return 'Bueno';
    if (percent >= 70) return 'Regular';
    return 'En riesgo';
  }
}
