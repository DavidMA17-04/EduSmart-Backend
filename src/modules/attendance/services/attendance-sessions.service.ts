import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Role } from '../../../common/enums/role.enum';
import { AttendanceSessionStatus } from '../../../common/enums/attendance-session-status.enum';
import { AcademicOfferingKind } from '../../../common/enums/academic-offering-kind.enum';
import {
  calendarDateInTimeZone,
  isWithinScheduleStartWindow,
  localClockInTimeZone,
} from '../../../common/utils/business-calendar-date.util';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { AcademicOfferingEligibilityService } from '../../administrative/academic-offerings/services/academic-offering-eligibility.service';
import { TeachingAssignment } from '../../administrative/teaching-assignments/entities/teaching-assignment.entity';
import { isImpartableTeachingAssignment } from '../../administrative/teaching-assignments/utils/assignment-offering.util';
import { AuditLog } from '../../administrative/users/entities/audit-log.entity';
import { ScheduleEntry } from '../../schedule/entities/schedule-entry.entity';
import {
  groupScheduleOccurrences,
  resolveOccurrenceForEntry,
  type ScheduleOccurrenceRun,
} from '../../schedule/utils/schedule-occurrence.util';
import { CreateAttendanceSessionDto } from '../dto/create-attendance-session.dto';
import { CreateAttendanceSessionFromScheduleDto } from '../dto/create-attendance-session-from-schedule.dto';
import { AttendanceSession } from '../entities/attendance-session.entity';
import { offeringKindLabel } from '../utils/attendance-labels.util';
import { toScheduleOccurrenceInput } from '../utils/schedule-occurrence-input.util';

export type AvailableOfferingView = {
  teachingAssignmentId: number;
  offeringKind: AcademicOfferingKind;
  offeringId: number;
  name: string;
  labelKind: string;
};

export type AttendanceGroupView = {
  groupId: number;
  name: string;
  gradeLevel: number;
  sectionId: number;
};

export type AttendanceSessionDetailView = {
  sessionId: number;
  status: AttendanceSessionStatus;
  sessionDate: string;
  startedAt: Date;
  closedAt: Date | null;
  teachingAssignmentId: number;
  group: {
    id: number;
    name: string;
    gradeLevel: number;
  };
  offering: {
    kind: AcademicOfferingKind;
    id: number;
    name: string;
    labelKind: string;
  };
};

export type AttendanceScheduleOccurrenceContext = {
  anchorEntryId: number;
  entryIds: number[];
  teachingAssignmentId: number;
  startTime: string;
  endTime: string;
  withinStartWindow: boolean;
  attendanceSession: null | { id: number; status: AttendanceSessionStatus };
};

export type AttendanceScheduleContextView = {
  date: string;
  dayOfWeek: number;
  occurrences: AttendanceScheduleOccurrenceContext[];
};

/**
 * PENDING (business decision): may a teacher have more than one AttendanceSession
 * OPEN for the same TeachingAssignment? Currently allowed; no UNIQUE/lock yet.
 */
@Injectable()
export class AttendanceSessionsService {
  constructor(
    @InjectRepository(AttendanceSession)
    private readonly sessions: Repository<AttendanceSession>,
    @InjectRepository(TeachingAssignment)
    private readonly teachingAssignments: Repository<TeachingAssignment>,
    @InjectRepository(ScheduleEntry)
    private readonly scheduleEntries: Repository<ScheduleEntry>,
    private readonly eligibility: AcademicOfferingEligibilityService,
    private readonly dataSource: DataSource,
  ) {}

  async listAvailableOfferings(
    groupId: number,
    actor: AuthenticatedUser,
  ): Promise<AvailableOfferingView[]> {
    await this.eligibility.getGradeLevelForGroup(groupId);
    const allowedKinds = await this.eligibility.allowedKindsForGroup(groupId);

    const qb = this.teachingAssignments
      .createQueryBuilder('ta')
      .leftJoinAndSelect('ta.subject', 'subject')
      .leftJoinAndSelect('ta.specialty', 'specialty')
      .where('ta.id_groups = :groupId', { groupId })
      .andWhere('ta.offering_kind IS NOT NULL');

    if (!this.isAdminActor(actor)) {
      qb.andWhere('ta.id_users = :teacherId', { teacherId: actor.id });
    }

    const rows = await qb.getMany();
    const views: AvailableOfferingView[] = [];

    for (const ta of rows) {
      if (!isImpartableTeachingAssignment(ta) || !ta.offeringKind) continue;
      if (!allowedKinds.includes(ta.offeringKind)) continue;

      const offeringId =
        ta.offeringKind === AcademicOfferingKind.SUBJECT
          ? ta.subjectId
          : ta.specialtyId;
      if (offeringId == null) continue;

      const name =
        ta.offeringKind === AcademicOfferingKind.SUBJECT
          ? ta.subject?.name
          : ta.specialty?.name;
      if (!name) continue;

      views.push({
        teachingAssignmentId: ta.id,
        offeringKind: ta.offeringKind,
        offeringId,
        name,
        labelKind: offeringKindLabel(ta.offeringKind),
      });
    }

    return views;
  }

  /**
   * Groups relevant for attendance: at least one impartable TA for the actor
   * (or any teacher if admin), coherent with grade eligibility.
   */
  async listAttendanceGroups(
    actor: AuthenticatedUser,
  ): Promise<AttendanceGroupView[]> {
    const qb = this.teachingAssignments
      .createQueryBuilder('ta')
      .innerJoinAndSelect('ta.group', 'g')
      .innerJoinAndSelect('g.section', 's')
      .where('ta.offering_kind IS NOT NULL');

    if (!this.isAdminActor(actor)) {
      qb.andWhere('ta.id_users = :teacherId', { teacherId: actor.id });
    }

    const rows = await qb.getMany();
    const policy = this.eligibility.getPolicy();
    const byGroupId = new Map<
      number,
      {
        name: string;
        gradeLevel: number;
        sectionId: number;
        kinds: AcademicOfferingKind[];
      }
    >();

    for (const ta of rows) {
      if (!isImpartableTeachingAssignment(ta) || !ta.offeringKind) continue;
      const group = ta.group;
      if (!group?.section) continue;

      const existing = byGroupId.get(group.id);
      if (existing) {
        existing.kinds.push(ta.offeringKind);
      } else {
        byGroupId.set(group.id, {
          name: group.name,
          gradeLevel: group.section.gradeLevel,
          sectionId: group.sectionId,
          kinds: [ta.offeringKind],
        });
      }
    }

    const views: AttendanceGroupView[] = [];
    for (const [groupId, row] of byGroupId) {
      const eligible = row.kinds.some((kind) =>
        policy.isKindAllowedForGrade(kind, row.gradeLevel),
      );
      if (!eligible) continue;
      views.push({
        groupId,
        name: row.name,
        gradeLevel: row.gradeLevel,
        sectionId: row.sectionId,
      });
    }

    views.sort((a, b) => {
      if (a.gradeLevel !== b.gradeLevel) return a.gradeLevel - b.gradeLevel;
      return a.name.localeCompare(b.name, 'es');
    });

    return views;
  }

  async getSessionDetail(
    sessionId: number,
    actor: AuthenticatedUser,
  ): Promise<AttendanceSessionDetailView> {
    const session = await this.findOne(sessionId);
    this.assertCanManageTeachingAssignment(session.teachingAssignment, actor);

    const ta = session.teachingAssignment;
    if (!ta?.offeringKind || !isImpartableTeachingAssignment(ta)) {
      throw new BadRequestException({
        code: 'ATTENDANCE_SESSION_GUIDE_ONLY',
        message: 'Session teaching assignment is not impartable',
      });
    }

    const group = ta.group;
    if (!group?.section) {
      throw new BadRequestException({
        code: 'ATTENDANCE_SESSION_GROUP_INCOMPLETE',
        message: 'Session group/section data is incomplete',
      });
    }

    const offeringId =
      ta.offeringKind === AcademicOfferingKind.SUBJECT
        ? ta.subjectId
        : ta.specialtyId;
    const offeringName =
      ta.offeringKind === AcademicOfferingKind.SUBJECT
        ? ta.subject?.name
        : ta.specialty?.name;

    if (offeringId == null || !offeringName) {
      throw new BadRequestException({
        code: 'ATTENDANCE_SESSION_OFFERING_INCOMPLETE',
        message: 'Session offering data is incomplete',
      });
    }

    return {
      sessionId: session.id,
      status: session.status,
      sessionDate: session.sessionDate,
      startedAt: session.startedAt,
      closedAt: session.closedAt ?? null,
      teachingAssignmentId: session.teachingAssignmentId,
      group: {
        id: group.id,
        name: group.name,
        gradeLevel: group.section.gradeLevel,
      },
      offering: {
        kind: ta.offeringKind,
        id: offeringId,
        name: offeringName,
        labelKind: offeringKindLabel(ta.offeringKind),
      },
    };
  }

  async createSession(
    dto: CreateAttendanceSessionDto,
    actor: AuthenticatedUser,
  ): Promise<AttendanceSession> {
    const ta = await this.teachingAssignments.findOne({
      where: { id: dto.teachingAssignmentId },
      relations: { subject: true, specialty: true, group: { section: true } },
    });
    if (!ta) {
      throw new NotFoundException(
        `TeachingAssignment ${dto.teachingAssignmentId} not found`,
      );
    }

    this.assertCanManageTeachingAssignment(ta, actor);

    if (ta.groupId !== dto.groupId) {
      throw new BadRequestException({
        code: 'ATTENDANCE_SESSION_GROUP_MISMATCH',
        message: 'teachingAssignmentId does not belong to the given groupId',
      });
    }

    if (!isImpartableTeachingAssignment(ta) || !ta.offeringKind) {
      throw new BadRequestException({
        code: 'ATTENDANCE_SESSION_GUIDE_ONLY',
        message: 'Guide-only teaching assignments cannot start a class session',
      });
    }

    await this.eligibility.assertOfferingAllowedForGroup(
      ta.groupId,
      ta.offeringKind,
    );

    const now = new Date();
    const sessionDate = calendarDateInTimeZone(now);

    const savedId = await this.dataSource.transaction(async (manager) => {
      const sessionRepo = manager.getRepository(AttendanceSession);
      const auditRepo = manager.getRepository(AuditLog);

      const saved = await sessionRepo.save(
        sessionRepo.create({
          teachingAssignmentId: ta.id,
          scheduleEntryId: null,
          sessionDate,
          startedAt: now,
          closedAt: null,
          status: AttendanceSessionStatus.OPEN,
          createdByUserId: actor.id,
        }),
      );

      await auditRepo.save(
        auditRepo.create({
          actorId: actor.id,
          action: 'ATTENDANCE_SESSION_CREATED',
          entity: 'AttendanceSession',
          entityId: String(saved.id),
          after: {
            id: saved.id,
            teachingAssignmentId: ta.id,
            groupId: ta.groupId,
            sessionDate,
            status: saved.status,
            scheduleEntryId: null,
            source: 'MANUAL',
          },
        }),
      );

      return saved.id;
    });

    return this.findOne(savedId);
  }

  async createSessionFromSchedule(
    dto: CreateAttendanceSessionFromScheduleDto,
    actor: AuthenticatedUser,
    now: Date = new Date(),
  ): Promise<AttendanceSession> {
    const clock = localClockInTimeZone(now);
    const { run, teachingAssignment } = await this.resolveOwnedOccurrence(
      dto.scheduleEntryId,
      actor,
    );

    if (clock.dayOfWeek !== run.dayOfWeek) {
      throw new BadRequestException({
        code: 'ATTENDANCE_SCHEDULE_WRONG_DAY',
        message:
          'Schedule occurrence dayOfWeek does not match today in America/Costa_Rica',
        expectedDayOfWeek: run.dayOfWeek,
        todayDayOfWeek: clock.dayOfWeek,
        date: clock.date,
      });
    }

    const existing = await this.findByAnchorAndDate(
      run.anchorEntryId,
      clock.date,
    );
    if (existing) {
      return existing;
    }

    if (
      !isWithinScheduleStartWindow(run.startTime, run.endTime, clock.time)
    ) {
      throw new BadRequestException({
        code: 'ATTENDANCE_OUTSIDE_SCHEDULE_WINDOW',
        message:
          'Attendance can only be started from 10 minutes before the first block until the end of the occurrence',
        startTime: run.startTime,
        endTime: run.endTime,
        localTime: clock.time,
      });
    }

    try {
      const savedId = await this.dataSource.transaction(async (manager) => {
        const sessionRepo = manager.getRepository(AttendanceSession);
        const auditRepo = manager.getRepository(AuditLog);

        const saved = await sessionRepo.save(
          sessionRepo.create({
            teachingAssignmentId: teachingAssignment.id,
            scheduleEntryId: run.anchorEntryId,
            sessionDate: clock.date,
            startedAt: now,
            closedAt: null,
            status: AttendanceSessionStatus.OPEN,
            createdByUserId: actor.id,
          }),
        );

        await auditRepo.save(
          auditRepo.create({
            actorId: actor.id,
            action: 'ATTENDANCE_SESSION_CREATED',
            entity: 'AttendanceSession',
            entityId: String(saved.id),
            after: {
              id: saved.id,
              teachingAssignmentId: teachingAssignment.id,
              groupId: teachingAssignment.groupId,
              sessionDate: clock.date,
              status: saved.status,
              scheduleEntryId: run.anchorEntryId,
              source: 'SCHEDULE',
              entryIds: run.entryIds,
            },
          }),
        );

        return saved.id;
      });

      return this.findOne(savedId);
    } catch (error) {
      if (this.isDuplicateAnchorDate(error)) {
        const raced = await this.findByAnchorAndDate(
          run.anchorEntryId,
          clock.date,
        );
        if (raced) return raced;
      }
      throw error;
    }
  }

  async getScheduleContext(
    actor: AuthenticatedUser,
    filters: { periodId?: number } = {},
    now: Date = new Date(),
  ): Promise<AttendanceScheduleContextView> {
    const clock = localClockInTimeZone(now);
    if (clock.dayOfWeek < 1 || clock.dayOfWeek > 5) {
      return { date: clock.date, dayOfWeek: clock.dayOfWeek, occurrences: [] };
    }

    const qb = this.scheduleEntries
      .createQueryBuilder('entry')
      .innerJoinAndSelect('entry.timeSlot', 'timeSlot')
      .innerJoinAndSelect('entry.teachingAssignment', 'ta')
      .where('entry.day_of_week = :dayOfWeek', { dayOfWeek: clock.dayOfWeek });

    if (!this.isAdminActor(actor)) {
      qb.andWhere('ta.id_users = :teacherId', { teacherId: actor.id });
    }
    if (filters.periodId != null) {
      qb.andWhere('ta.id_academic_periods = :periodId', {
        periodId: filters.periodId,
      });
    }

    const rows = await qb.getMany();
    const inputs = rows.map(toScheduleOccurrenceInput);
    const runs = groupScheduleOccurrences(inputs);
    if (runs.length === 0) {
      return { date: clock.date, dayOfWeek: clock.dayOfWeek, occurrences: [] };
    }

    const anchors = runs.map((r) => r.anchorEntryId);
    const sessions = await this.sessions.find({
      where: {
        scheduleEntryId: In(anchors),
        sessionDate: clock.date,
      },
    });
    const byAnchor = new Map(
      sessions
        .filter((s) => s.scheduleEntryId != null)
        .map((s) => [s.scheduleEntryId as number, s]),
    );

    const occurrences: AttendanceScheduleOccurrenceContext[] = runs.map(
      (run) => {
        const session = byAnchor.get(run.anchorEntryId) ?? null;
        return {
          anchorEntryId: run.anchorEntryId,
          entryIds: run.entryIds,
          teachingAssignmentId: run.teachingAssignmentId,
          startTime: run.startTime,
          endTime: run.endTime,
          withinStartWindow: isWithinScheduleStartWindow(
            run.startTime,
            run.endTime,
            clock.time,
          ),
          attendanceSession: session
            ? { id: session.id, status: session.status }
            : null,
        };
      },
    );

    return {
      date: clock.date,
      dayOfWeek: clock.dayOfWeek,
      occurrences,
    };
  }

  private async resolveOwnedOccurrence(
    scheduleEntryId: number,
    actor: AuthenticatedUser,
  ): Promise<{ run: ScheduleOccurrenceRun; teachingAssignment: TeachingAssignment }> {
    const seed = await this.scheduleEntries.findOne({
      where: { id: scheduleEntryId },
      relations: {
        timeSlot: true,
        teachingAssignment: {
          subject: true,
          specialty: true,
          group: { section: true },
        },
      },
    });
    if (!seed) {
      throw new NotFoundException(`ScheduleEntry ${scheduleEntryId} not found`);
    }

    const ta = seed.teachingAssignment;
    if (!ta) {
      throw new BadRequestException({
        code: 'ATTENDANCE_SESSION_GUIDE_ONLY',
        message: 'Schedule entry teaching assignment is incomplete',
      });
    }
    this.assertCanManageTeachingAssignment(ta, actor);

    if (!isImpartableTeachingAssignment(ta) || !ta.offeringKind) {
      throw new BadRequestException({
        code: 'ATTENDANCE_SESSION_GUIDE_ONLY',
        message: 'Guide-only teaching assignments cannot start a class session',
      });
    }

    await this.eligibility.assertOfferingAllowedForGroup(
      ta.groupId,
      ta.offeringKind,
    );

    const siblings = await this.scheduleEntries.find({
      where: {
        teachingAssignmentId: seed.teachingAssignmentId,
        dayOfWeek: seed.dayOfWeek,
      },
      relations: { timeSlot: true },
    });
    const inputs = siblings.map(toScheduleOccurrenceInput);
    const run = resolveOccurrenceForEntry(inputs, scheduleEntryId);
    if (!run) {
      throw new BadRequestException({
        code: 'ATTENDANCE_SCHEDULE_ENTRY_NOT_CLASS',
        message: 'Schedule entry is not part of a CLASS occurrence run',
      });
    }

    return { run, teachingAssignment: ta };
  }

  private async findByAnchorAndDate(
    anchorEntryId: number,
    sessionDate: string,
  ): Promise<AttendanceSession | null> {
    const found = await this.sessions.findOne({
      where: { scheduleEntryId: anchorEntryId, sessionDate },
    });
    if (!found) return null;
    return this.findOne(found.id);
  }

  private isDuplicateAnchorDate(error: unknown): boolean {
    const err = error as { code?: string; errno?: number; message?: string };
    if (err?.code === 'ER_DUP_ENTRY' || err?.errno === 1062) return true;
    const msg = String(err?.message ?? '');
    return /UQ_attendance_sessions_schedule_anchor_date/i.test(msg);
  }

  async closeSession(
    sessionId: number,
    actor: AuthenticatedUser,
  ): Promise<AttendanceSession> {
    await this.dataSource.transaction(async (manager) => {
      const sessionRepo = manager.getRepository(AttendanceSession);
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

      this.assertCanManageTeachingAssignment(session.teachingAssignment, actor);

      if (session.status === AttendanceSessionStatus.CLOSED) {
        throw new BadRequestException({
          code: 'ATTENDANCE_SESSION_ALREADY_CLOSED',
          message: 'Attendance session is already CLOSED',
        });
      }

      const before = {
        id: session.id,
        status: session.status,
        closedAt: session.closedAt,
      };

      session.status = AttendanceSessionStatus.CLOSED;
      session.closedAt = new Date();
      await sessionRepo.save(session);

      await auditRepo.save(
        auditRepo.create({
          actorId: actor.id,
          action: 'ATTENDANCE_SESSION_CLOSED',
          entity: 'AttendanceSession',
          entityId: String(session.id),
          before,
          after: {
            id: session.id,
            status: session.status,
            closedAt: session.closedAt,
          },
        }),
      );
    });

    return this.findOne(sessionId);
  }

  async findOne(sessionId: number): Promise<AttendanceSession> {
    const session = await this.sessions.findOne({
      where: { id: sessionId },
      relations: {
        teachingAssignment: {
          subject: true,
          specialty: true,
          group: { section: true },
          user: true,
        },
      },
    });
    if (!session) {
      throw new NotFoundException(`AttendanceSession ${sessionId} not found`);
    }
    return session;
  }

  assertCanManageTeachingAssignment(
    ta: TeachingAssignment,
    actor: AuthenticatedUser,
  ): void {
    if (this.isAdminActor(actor)) return;
    if (ta.userId === actor.id) return;
    throw new ForbiddenException({
      code: 'ATTENDANCE_SESSION_FORBIDDEN',
      message: 'You are not authorized to manage this teaching assignment session',
    });
  }

  isAdminActor(actor: AuthenticatedUser): boolean {
    return (actor.roles ?? []).includes(Role.ADMIN);
  }
}
