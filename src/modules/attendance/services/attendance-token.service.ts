import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { AcademicOfferingKind } from '../../../common/enums/academic-offering-kind.enum';
import { AttendanceRegistrationMethod } from '../../../common/enums/attendance-registration-method.enum';
import { AttendanceSessionStatus } from '../../../common/enums/attendance-session-status.enum';
import { AttendanceStatus } from '../../../common/enums/attendance-status.enum';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { GroupEnrollment } from '../../administrative/group-enrollments/entities/group-enrollment.entity';
import { AuditLog } from '../../administrative/users/entities/audit-log.entity';
import {
  RedeemAttendanceTokenDto,
  resolveRedeemToken,
} from '../dto/redeem-attendance-token.dto';
import { Attendance } from '../entities/attendance.entity';
import { AttendanceSession } from '../entities/attendance-session.entity';
import { offeringKindLabel } from '../utils/attendance-labels.util';
import { isStudentActor } from '../utils/attendance-actor.util';
import { AttendanceRecordsService } from './attendance-records.service';
import { AttendanceSessionsService } from './attendance-sessions.service';

/** Costa Rica observes UTC−6 year-round (no DST). */
const CR_OFFSET = '-06:00';

export type AttendanceTokenView = {
  sessionId: number;
  token: string;
  expiresAt: Date;
};

export type RedeemAttendanceTokenView = {
  attendanceId: number;
  sessionId: number;
  studentUserId: number;
  status: AttendanceStatus;
  registrationMethod: AttendanceRegistrationMethod;
  registeredAt: Date;
  alreadyRedeemed: boolean;
  sessionDate: string;
  groupName: string;
  offeringName: string;
  offeringLabelKind: string;
};

@Injectable()
export class AttendanceTokenService {
  constructor(
    @InjectRepository(AttendanceSession)
    private readonly sessions: Repository<AttendanceSession>,
    @InjectRepository(Attendance)
    private readonly attendance: Repository<Attendance>,
    private readonly sessionsService: AttendanceSessionsService,
    private readonly recordsService: AttendanceRecordsService,
    private readonly dataSource: DataSource,
  ) {}

  async generateToken(
    sessionId: number,
    actor: AuthenticatedUser,
  ): Promise<AttendanceTokenView> {
    const session = await this.sessions.findOne({
      where: { id: sessionId },
      relations: {
        teachingAssignment: true,
        scheduleEntry: { timeSlot: true },
      },
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
        message: 'Tokens can only be generated for OPEN sessions',
      });
    }

    const token = this.createSecureToken();
    const expiresAt = this.resolveTokenExpiresAt(session);

    session.attendanceToken = token;
    session.attendanceTokenExpiresAt = expiresAt;
    await this.sessions.save(session);

    await this.dataSource.getRepository(AuditLog).save(
      this.dataSource.getRepository(AuditLog).create({
        actorId: actor.id,
        action: 'ATTENDANCE_SESSION_TOKEN_GENERATED',
        entity: 'AttendanceSession',
        entityId: String(session.id),
        after: {
          sessionId: session.id,
          expiresAt,
        },
      }),
    );

    return { sessionId: session.id, token, expiresAt };
  }

  async redeemToken(
    dto: RedeemAttendanceTokenDto,
    actor: AuthenticatedUser,
  ): Promise<RedeemAttendanceTokenView> {
    if (!isStudentActor(actor)) {
      throw new ForbiddenException({
        code: 'ATTENDANCE_TOKEN_STUDENT_ONLY',
        message: 'Only students can redeem attendance tokens',
      });
    }

    const token = resolveRedeemToken(dto);
    if (!token || token.length < 6) {
      throw new BadRequestException({
        code: 'ATTENDANCE_TOKEN_REQUIRED',
        message: 'Provide a valid attendance token/code',
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const sessionRepo = manager.getRepository(AttendanceSession);
      const attendanceRepo = manager.getRepository(Attendance);
      const enrollmentRepo = manager.getRepository(GroupEnrollment);
      const auditRepo = manager.getRepository(AuditLog);

      const session = await sessionRepo.findOne({
        where: { attendanceToken: token },
        relations: {
          teachingAssignment: {
            group: true,
            subject: true,
            specialty: true,
          },
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!session) {
        throw new NotFoundException({
          code: 'ATTENDANCE_TOKEN_INVALID',
          message: 'Attendance token not found',
        });
      }

      if (session.status !== AttendanceSessionStatus.OPEN) {
        throw new BadRequestException({
          code: 'ATTENDANCE_SESSION_NOT_OPEN',
          message: 'Attendance session is not OPEN',
        });
      }

      const expiresAt = session.attendanceTokenExpiresAt;
      if (!expiresAt || expiresAt.getTime() < Date.now()) {
        throw new BadRequestException({
          code: 'ATTENDANCE_TOKEN_EXPIRED',
          message: 'Attendance token has expired',
        });
      }

      const roster = await this.recordsService.loadRosterUsers(
        session.teachingAssignment.groupId,
        session.sessionDate,
        enrollmentRepo,
      );
      if (!roster.some((u) => u.id === actor.id)) {
        throw new ForbiddenException({
          code: 'ATTENDANCE_TOKEN_NOT_ENROLLED',
          message: 'You are not enrolled in the group for this session',
        });
      }

      const classInfo = this.buildClassInfo(session);
      const existing = await attendanceRepo.findOne({
        where: {
          attendanceSessionId: session.id,
          studentUserId: actor.id,
        },
      });

      if (existing) {
        const alreadyTokenPresent =
          existing.status === AttendanceStatus.PRESENT &&
          existing.registrationMethod === AttendanceRegistrationMethod.TOKEN;

        if (!alreadyTokenPresent) {
          const before = {
            id: existing.id,
            status: existing.status,
            registrationMethod: existing.registrationMethod,
          };
          existing.status = AttendanceStatus.PRESENT;
          existing.registrationMethod = AttendanceRegistrationMethod.TOKEN;
          existing.updatedByUserId = actor.id;
          await attendanceRepo.save(existing);
          await auditRepo.save(
            auditRepo.create({
              actorId: actor.id,
              action: 'ATTENDANCE_RECORD_UPDATED',
              entity: 'Attendance',
              entityId: String(existing.id),
              before,
              after: {
                id: existing.id,
                status: existing.status,
                registrationMethod: existing.registrationMethod,
                source: 'TOKEN',
              },
            }),
          );
        }

        return {
          attendanceId: existing.id,
          sessionId: session.id,
          studentUserId: existing.studentUserId,
          status: AttendanceStatus.PRESENT,
          registrationMethod: AttendanceRegistrationMethod.TOKEN,
          registeredAt: existing.registeredAt,
          alreadyRedeemed: true,
          ...classInfo,
        };
      }

      const now = new Date();
      let created: Attendance;
      try {
        created = await attendanceRepo.save(
          attendanceRepo.create({
            attendanceSessionId: session.id,
            studentUserId: actor.id,
            status: AttendanceStatus.PRESENT,
            registrationMethod: AttendanceRegistrationMethod.TOKEN,
            registeredAt: now,
            registeredByUserId: actor.id,
            updatedByUserId: null,
          }),
        );
      } catch (error) {
        const err = error as { code?: string; errno?: number };
        if (err?.code === 'ER_DUP_ENTRY' || err?.errno === 1062) {
          const raced = await attendanceRepo.findOne({
            where: {
              attendanceSessionId: session.id,
              studentUserId: actor.id,
            },
          });
          if (raced) {
            return {
              attendanceId: raced.id,
              sessionId: session.id,
              studentUserId: raced.studentUserId,
              status: AttendanceStatus.PRESENT,
              registrationMethod: AttendanceRegistrationMethod.TOKEN,
              registeredAt: raced.registeredAt,
              alreadyRedeemed: true,
              ...classInfo,
            };
          }
        }
        throw error;
      }

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
            source: 'TOKEN',
          },
        }),
      );

      return {
        attendanceId: created.id,
        sessionId: session.id,
        studentUserId: created.studentUserId,
        status: created.status,
        registrationMethod: created.registrationMethod,
        registeredAt: created.registeredAt,
        alreadyRedeemed: false,
        ...classInfo,
      };
    });
  }

  private buildClassInfo(session: AttendanceSession): {
    sessionDate: string;
    groupName: string;
    offeringName: string;
    offeringLabelKind: string;
  } {
    const ta = session.teachingAssignment;
    const kind = ta?.offeringKind ?? null;
    let offeringName = '—';
    if (kind === AcademicOfferingKind.SUBJECT) {
      offeringName = ta.subject?.name ?? '—';
    } else if (kind) {
      offeringName = ta.specialty?.name ?? '—';
    }
    return {
      sessionDate: String(session.sessionDate).slice(0, 10),
      groupName: ta?.group?.name ?? '—',
      offeringName,
      offeringLabelKind: kind ? offeringKindLabel(kind) : '—',
    };
  }

  resolveTokenExpiresAt(session: AttendanceSession): Date {
    const day = String(session.sessionDate).slice(0, 10);
    const endTime =
      session.scheduleEntry?.timeSlot?.endTime != null
        ? String(session.scheduleEntry.timeSlot.endTime)
        : '23:59:59';
    return costaRicaLocalToUtcDate(day, endTime);
  }

  private createSecureToken(length = 8): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = randomBytes(length);
    let out = '';
    for (let i = 0; i < length; i += 1) {
      out += alphabet[bytes[i]! % alphabet.length];
    }
    return out;
  }
}

export function costaRicaLocalToUtcDate(
  dateYmd: string,
  timeHms: string,
): Date {
  const raw = String(timeHms ?? '');
  const full = raw.match(/(\d{2}:\d{2}:\d{2})/);
  const short = raw.match(/(\d{2}:\d{2})/);
  const normalized = full
    ? full[1]
    : short
      ? `${short[1]}:00`
      : '23:59:59';
  return new Date(`${dateYmd}T${normalized}${CR_OFFSET}`);
}
