import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { AcademicOfferingKind } from '../../../common/enums/academic-offering-kind.enum';
import { AttendanceRegistrationMethod } from '../../../common/enums/attendance-registration-method.enum';
import { AttendanceStatus } from '../../../common/enums/attendance-status.enum';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import {
  AttendanceHistoryFilterDto,
  AttendanceHistorySortBy,
} from '../dto/attendance-history-filter.dto';
import { Attendance } from '../entities/attendance.entity';
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
};

export type AttendanceHistoryPageView = {
  items: AttendanceHistoryItemView[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

@Injectable()
export class AttendanceHistoryService {
  constructor(
    @InjectRepository(Attendance)
    private readonly attendance: Repository<Attendance>,
    private readonly sessionsService: AttendanceSessionsService,
  ) {}

  async search(
    filters: AttendanceHistoryFilterDto,
    actor: AuthenticatedUser,
  ): Promise<AttendanceHistoryPageView> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 25;
    const sortBy: AttendanceHistorySortBy = filters.sortBy ?? 'sessionDate';
    const sortOrder = filters.sortOrder ?? 'DESC';

    const qb = this.attendance
      .createQueryBuilder('a')
      .innerJoinAndSelect('a.session', 'session')
      .innerJoinAndSelect('session.teachingAssignment', 'ta')
      .leftJoinAndSelect('ta.group', 'grp')
      .leftJoinAndSelect('grp.section', 'section')
      .leftJoinAndSelect('ta.subject', 'subject')
      .leftJoinAndSelect('ta.specialty', 'specialty')
      .leftJoinAndSelect('ta.user', 'teacher')
      .innerJoinAndSelect('a.student', 'student');

    if (!this.sessionsService.isAdminActor(actor)) {
      qb.andWhere('ta.id_users = :teacherId', { teacherId: actor.id });
    }

    this.applyFilters(qb, filters);
    this.applySort(qb, sortBy, sortOrder);

    const total = await qb.clone().getCount();
    const rows = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    const items = rows.map((row) => this.toItem(row));
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return { items, total, page, limit, totalPages };
  }

  private applyFilters(
    qb: SelectQueryBuilder<Attendance>,
    filters: AttendanceHistoryFilterDto,
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
    if (filters.studentId != null) {
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
    if (filters.search) {
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

  private toItem(row: Attendance): AttendanceHistoryItemView {
    const session = row.session;
    const ta = session.teachingAssignment;
    const teacher = ta.user;
    const student = row.student;

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
    };
  }
}
