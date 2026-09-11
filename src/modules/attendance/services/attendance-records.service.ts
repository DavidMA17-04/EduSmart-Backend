import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { INSTITUTIONAL_ROLE_STUDENT } from '../../../common/constants/institutional-roles.constant';
import { AttendanceRegistrationMethod } from '../../../common/enums/attendance-registration-method.enum';
import { AttendanceSessionStatus } from '../../../common/enums/attendance-session-status.enum';
import { AttendanceStatus } from '../../../common/enums/attendance-status.enum';
import { RoleStatus } from '../../../common/enums/role-status.enum';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { GroupEnrollment } from '../../administrative/group-enrollments/entities/group-enrollment.entity';
import { AuditLog } from '../../administrative/users/entities/audit-log.entity';
import { UpsertAttendanceRecordsDto } from '../dto/upsert-attendance-records.dto';
import { Attendance } from '../entities/attendance.entity';
import { AttendanceSession } from '../entities/attendance-session.entity';
import { AttendanceSessionsService } from './attendance-sessions.service';
import { formatUserFullName } from '../utils/attendance-labels.util';

export type RosterStudentView = {
  userId: number;
  nationalId: string;
  fullName: string;
  attendance: {
    id: number;
    status: AttendanceStatus;
    registrationMethod: AttendanceRegistrationMethod;
    registeredAt: Date;
    registeredByUserId: number;
    updatedAt: Date;
    updatedByUserId: number | null;
  } | null;
};

@Injectable()
export class AttendanceRecordsService {
  constructor(
    @InjectRepository(Attendance)
    private readonly attendance: Repository<Attendance>,
    @InjectRepository(GroupEnrollment)
    private readonly enrollments: Repository<GroupEnrollment>,
    private readonly sessionsService: AttendanceSessionsService,
    private readonly dataSource: DataSource,
  ) {}

  async getRoster(
    sessionId: number,
    actor: AuthenticatedUser,
  ): Promise<RosterStudentView[]> {
    const session = await this.sessionsService.findOne(sessionId);
    this.sessionsService.assertCanManageTeachingAssignment(
      session.teachingAssignment,
      actor,
    );

    const students = await this.loadRosterUsers(
      session.teachingAssignment.groupId,
      session.sessionDate,
    );
    const existing =
      students.length === 0
        ? []
        : await this.attendance.find({
            where: {
              attendanceSessionId: session.id,
              studentUserId: In(students.map((s) => s.id)),
            },
          });
    const byStudent = new Map(existing.map((row) => [row.studentUserId, row]));

    return students.map((user) => {
      const row = byStudent.get(user.id) ?? null;
      return {
        userId: user.id,
        nationalId: user.national_id,
        fullName: formatUserFullName(user),
        attendance: row
          ? {
              id: row.id,
              status: row.status,
              registrationMethod: row.registrationMethod,
              registeredAt: row.registeredAt,
              registeredByUserId: row.registeredByUserId,
              updatedAt: row.updatedAt,
              updatedByUserId: row.updatedByUserId ?? null,
            }
          : null,
      };
    });
  }

  async upsertRecords(
    sessionId: number,
    dto: UpsertAttendanceRecordsDto,
    actor: AuthenticatedUser,
  ): Promise<Attendance[]> {
    return this.dataSource.transaction(async (manager) => {
      const sessionRepo = manager.getRepository(AttendanceSession);
      const attendanceRepo = manager.getRepository(Attendance);
      const auditRepo = manager.getRepository(AuditLog);

      const session = await sessionRepo.findOne({
        where: { id: sessionId },
        relations: {
          teachingAssignment: true,
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (!session) {
        throw new NotFoundException(`AttendanceSession ${sessionId} not found`);
      }

      this.sessionsService.assertCanManageTeachingAssignment(
        session.teachingAssignment,
        actor,
      );

      if (session.status !== AttendanceSessionStatus.OPEN) {
        throw new BadRequestException({
          code: 'ATTENDANCE_SESSION_NOT_OPEN',
          message: 'Attendance records can only be modified while session is OPEN',
        });
      }

      const rosterUsers = await this.loadRosterUsers(
        session.teachingAssignment.groupId,
        session.sessionDate,
        manager.getRepository(GroupEnrollment),
      );
      const rosterIds = new Set(rosterUsers.map((u) => u.id));

      const seen = new Set<number>();
      for (const item of dto.records) {
        if (seen.has(item.studentUserId)) {
          throw new BadRequestException({
            code: 'ATTENDANCE_DUPLICATE_STUDENT_IN_PAYLOAD',
            message: `Student ${item.studentUserId} appears more than once in records`,
          });
        }
        seen.add(item.studentUserId);

        if (!rosterIds.has(item.studentUserId)) {
          throw new BadRequestException({
            code: 'ATTENDANCE_STUDENT_NOT_IN_ROSTER',
            message: `Student ${item.studentUserId} is not in the historical roster for this session`,
          });
        }
      }

      const studentIds = dto.records.map((r) => r.studentUserId);
      const existingRows = await attendanceRepo.find({
        where: {
          attendanceSessionId: session.id,
          studentUserId: In(studentIds),
        },
      });
      const existingByStudent = new Map(
        existingRows.map((row) => [row.studentUserId, row]),
      );

      const now = new Date();
      const results: Attendance[] = [];

      for (const item of dto.records) {
        const existing = existingByStudent.get(item.studentUserId);
        if (!existing) {
          try {
            const created = await attendanceRepo.save(
              attendanceRepo.create({
                attendanceSessionId: session.id,
                studentUserId: item.studentUserId,
                status: item.status,
                registrationMethod: AttendanceRegistrationMethod.MANUAL,
                registeredAt: now,
                registeredByUserId: actor.id,
                updatedByUserId: null,
              }),
            );
            results.push(created);
            await auditRepo.save(
              auditRepo.create({
                actorId: actor.id,
                action: 'ATTENDANCE_RECORD_CREATED',
                entity: 'Attendance',
                entityId: String(created.id),
                after: {
                  id: created.id,
                  sessionId: session.id,
                  studentUserId: created.studentUserId,
                  status: created.status,
                  registrationMethod: created.registrationMethod,
                  registeredByUserId: created.registeredByUserId,
                },
              }),
            );
          } catch (error) {
            this.rethrowDuplicate(error);
            throw error;
          }
        } else {
          const before = {
            id: existing.id,
            status: existing.status,
            updatedByUserId: existing.updatedByUserId ?? null,
          };
          existing.status = item.status;
          existing.updatedByUserId = actor.id;
          const updated = await attendanceRepo.save(existing);
          results.push(updated);
          await auditRepo.save(
            auditRepo.create({
              actorId: actor.id,
              action: 'ATTENDANCE_RECORD_UPDATED',
              entity: 'Attendance',
              entityId: String(updated.id),
              before,
              after: {
                id: updated.id,
                status: updated.status,
                updatedByUserId: updated.updatedByUserId ?? null,
                registeredByUserId: updated.registeredByUserId,
              },
            }),
          );
        }
      }

      return results;
    });
  }

  async loadRosterUsers(
    groupId: number,
    sessionDate: string,
    enrollmentRepo: Repository<GroupEnrollment> = this.enrollments,
  ): Promise<
    Array<{
      id: number;
      national_id: string;
      name: string;
      first_lastname: string;
      second_lastname?: string | null;
      userRoles?: Array<{ role?: { name: string; status: RoleStatus } | null }>;
    }>
  > {
    const day = String(sessionDate).slice(0, 10);
    const rows = await enrollmentRepo
      .createQueryBuilder('e')
      .innerJoinAndSelect('e.user', 'u')
      .leftJoinAndSelect('u.userRoles', 'ur')
      .leftJoinAndSelect('ur.role', 'r')
      .where('e.id_groups = :groupId', { groupId })
      .andWhere('e.starts_on <= :day', { day })
      .andWhere('(e.ends_on IS NULL OR e.ends_on >= :day)', { day })
      .orderBy('u.first_lastname', 'ASC')
      .addOrderBy('u.name', 'ASC')
      .getMany();

    const students = rows
      .map((e) => e.user)
      .filter((user) =>
        (user.userRoles ?? []).some(
          (row) =>
            row.role?.status === RoleStatus.ACTIVE &&
            row.role.name === INSTITUTIONAL_ROLE_STUDENT,
        ),
      );

    const byId = new Map<number, (typeof students)[number]>();
    for (const user of students) {
      byId.set(user.id, user);
    }
    return [...byId.values()];
  }

  private rethrowDuplicate(error: unknown): void {
    const err = error as { code?: string; errno?: number };
    if (err?.code === 'ER_DUP_ENTRY' || err?.errno === 1062) {
      throw new ConflictException({
        code: 'ATTENDANCE_DUPLICATE',
        message:
          'An attendance record already exists for this student in the session',
      });
    }
  }
}
