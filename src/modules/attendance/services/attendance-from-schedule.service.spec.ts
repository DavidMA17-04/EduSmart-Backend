import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AcademicOfferingKind } from '../../../common/enums/academic-offering-kind.enum';
import { AttendanceSessionStatus } from '../../../common/enums/attendance-session-status.enum';
import { Role } from '../../../common/enums/role.enum';
import { ScheduleSlotType } from '../../../common/enums/schedule-slot-type.enum';
import { AcademicOfferingEligibilityPolicy } from '../../administrative/academic-offerings/policies/academic-offering-eligibility.policy';
import { AttendanceSessionsService } from './attendance-sessions.service';

describe('AttendanceSessionsService from-schedule / schedule-context (F)', () => {
  const sessions = {
    create: jest.fn((data) => ({ ...data })),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };
  const teachingAssignments = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const scheduleEntries = {
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const eligibility = {
    getGradeLevelForGroup: jest.fn(),
    allowedKindsForGroup: jest.fn(),
    assertOfferingAllowedForGroup: jest.fn(),
    getPolicy: jest.fn(() => new AcademicOfferingEligibilityPolicy()),
  };

  const sessionRepoTx = {
    create: jest.fn((data) => ({ ...data })),
    save: jest.fn(async (row) => ({ ...row, id: row.id ?? 50 })),
    findOne: jest.fn(),
  };
  const auditRepoTx = {
    create: jest.fn((data) => ({ ...data })),
    save: jest.fn(async (row) => row),
  };

  const dataSource = {
    transaction: jest.fn(async (fn: (m: unknown) => Promise<unknown>) => {
      const manager = {
        getRepository: (entity: { name?: string }) => {
          const name = entity.name ?? String(entity);
          if (name.includes('AttendanceSession')) return sessionRepoTx;
          if (name.includes('AuditLog')) return auditRepoTx;
          return sessionRepoTx;
        },
      };
      return fn(manager);
    }),
  };

  let service: AttendanceSessionsService;
  const teacher = {
    id: 10,
    email: 't@test.com',
    roles: [Role.TEACHER],
    permissions: ['attendance.create'],
    mustChangePassword: false,
  };
  const otherTeacher = {
    id: 99,
    email: 'o@test.com',
    roles: [Role.TEACHER],
    permissions: ['attendance.create'],
    mustChangePassword: false,
  };

  const ta = {
    id: 100,
    userId: 10,
    groupId: 20,
    offeringKind: AcademicOfferingKind.SUBJECT,
    subjectId: 3,
    specialtyId: null,
    subject: { name: 'Matemáticas' },
    specialty: null,
    group: { id: 20, name: '7-1', section: { gradeLevel: 7 } },
  };

  function classEntry(
    id: number,
    start: string,
    end: string,
    displayOrder = id,
  ) {
    return {
      id,
      teachingAssignmentId: 100,
      dayOfWeek: 1,
      timeSlotId: id,
      timeSlot: {
        id: id,
        startTime: start,
        endTime: end,
        displayOrder,
        slotType: ScheduleSlotType.CLASS,
      },
      teachingAssignment: ta,
    };
  }

  /** Monday 2026-09-14 12:00 UTC = 06:00 CR */
  const mondayEarly = new Date('2026-09-14T12:00:00.000Z');
  /** Monday 06:50 CR = 12:50 UTC */
  const mondayWindowOpen = new Date('2026-09-14T12:50:00.000Z');
  /** Monday 07:30 CR */
  const mondayDuring = new Date('2026-09-14T13:30:00.000Z');
  /** Monday 08:20 CR */
  const mondayAtEnd = new Date('2026-09-14T14:20:00.000Z');
  /** Monday 08:21 CR */
  const mondayAfter = new Date('2026-09-14T14:21:00.000Z');
  /** Tuesday */
  const tuesday = new Date('2026-09-15T13:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AttendanceSessionsService(
      sessions as never,
      teachingAssignments as never,
      scheduleEntries as never,
      eligibility as never,
      dataSource as never,
    );
    sessions.findOne.mockImplementation(async ({ where }) => {
      if (where?.id != null) {
        return {
          id: where.id,
          status: AttendanceSessionStatus.OPEN,
          teachingAssignmentId: 100,
          teachingAssignment: ta,
          scheduleEntryId: 1,
          sessionDate: '2026-09-14',
        };
      }
      return null;
    });
    sessionRepoTx.save.mockImplementation(async (row) => ({
      ...row,
      id: row.id ?? 50,
    }));
  });

  function stubOwnedRun(entries = [classEntry(1, '07:00:00', '07:40:00')]) {
    scheduleEntries.findOne.mockResolvedValue(entries[0]);
    scheduleEntries.find.mockResolvedValue(entries);
  }

  it('1. own single block → create', async () => {
    stubOwnedRun();
    sessions.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 50,
        status: AttendanceSessionStatus.OPEN,
        teachingAssignment: ta,
        teachingAssignmentId: 100,
        scheduleEntryId: 1,
        sessionDate: '2026-09-14',
      });

    const created = await service.createSessionFromSchedule(
      { scheduleEntryId: 1 },
      teacher,
      mondayDuring,
    );
    expect(created.id).toBe(50);
    expect(sessionRepoTx.create).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduleEntryId: 1,
        teachingAssignmentId: 100,
        sessionDate: '2026-09-14',
      }),
    );
    expect(auditRepoTx.create).toHaveBeenCalledWith(
      expect.objectContaining({
        after: expect.objectContaining({ source: 'SCHEDULE' }),
      }),
    );
  });

  it('2–4. multi-block run: any member → same anchor session', async () => {
    const entries = [
      classEntry(1, '07:00:00', '07:40:00', 1),
      classEntry(2, '07:40:00', '08:20:00', 2),
    ];
    stubOwnedRun(entries);
    sessions.findOne.mockResolvedValue(null);
    sessions.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 50,
        status: AttendanceSessionStatus.OPEN,
        teachingAssignment: ta,
        teachingAssignmentId: 100,
        scheduleEntryId: 1,
        sessionDate: '2026-09-14',
      });

    await service.createSessionFromSchedule(
      { scheduleEntryId: 2 },
      teacher,
      mondayDuring,
    );
    expect(sessionRepoTx.create).toHaveBeenCalledWith(
      expect.objectContaining({ scheduleEntryId: 1 }),
    );
  });

  it('5. other teacher → 403', async () => {
    stubOwnedRun();
    await expect(
      service.createSessionFromSchedule(
        { scheduleEntryId: 1 },
        otherTeacher,
        mondayDuring,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('6. wrong weekday → ATTENDANCE_SCHEDULE_WRONG_DAY', async () => {
    stubOwnedRun();
    try {
      await service.createSessionFromSchedule(
        { scheduleEntryId: 1 },
        teacher,
        tuesday,
      );
      throw new Error('expected reject');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect((e as BadRequestException).getResponse()).toMatchObject({
        code: 'ATTENDANCE_SCHEDULE_WRONG_DAY',
      });
    }
  });

  it('7. 10 min before → allowed', async () => {
    stubOwnedRun([
      classEntry(1, '07:00:00', '07:40:00'),
      classEntry(2, '07:40:00', '08:20:00'),
    ]);
    sessions.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 50,
        status: AttendanceSessionStatus.OPEN,
        teachingAssignment: ta,
        teachingAssignmentId: 100,
        scheduleEntryId: 1,
        sessionDate: '2026-09-14',
      });
    await expect(
      service.createSessionFromSchedule(
        { scheduleEntryId: 1 },
        teacher,
        mondayWindowOpen,
      ),
    ).resolves.toMatchObject({ id: 50 });
  });

  it('8. before -10 → ATTENDANCE_OUTSIDE_SCHEDULE_WINDOW', async () => {
    stubOwnedRun([
      classEntry(1, '07:00:00', '07:40:00'),
      classEntry(2, '07:40:00', '08:20:00'),
    ]);
    sessions.findOne.mockResolvedValue(null);
    try {
      await service.createSessionFromSchedule(
        { scheduleEntryId: 1 },
        teacher,
        mondayEarly,
      );
      throw new Error('expected reject');
    } catch (e) {
      expect((e as BadRequestException).getResponse()).toMatchObject({
        code: 'ATTENDANCE_OUTSIDE_SCHEDULE_WINDOW',
      });
    }
  });

  it('9–10. during allowed; after end without session rejected', async () => {
    stubOwnedRun([
      classEntry(1, '07:00:00', '07:40:00'),
      classEntry(2, '07:40:00', '08:20:00'),
    ]);
    sessions.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 50,
        status: AttendanceSessionStatus.OPEN,
        teachingAssignment: ta,
        teachingAssignmentId: 100,
        scheduleEntryId: 1,
        sessionDate: '2026-09-14',
      });
    await expect(
      service.createSessionFromSchedule(
        { scheduleEntryId: 1 },
        teacher,
        mondayAtEnd,
      ),
    ).resolves.toBeTruthy();

    sessions.findOne.mockResolvedValue(null);
    try {
      await service.createSessionFromSchedule(
        { scheduleEntryId: 1 },
        teacher,
        mondayAfter,
      );
      throw new Error('expected reject');
    } catch (e) {
      expect((e as BadRequestException).getResponse()).toMatchObject({
        code: 'ATTENDANCE_OUTSIDE_SCHEDULE_WINDOW',
      });
    }
  });

  it('11–13. existing OPEN/CLOSED returned (idempotent)', async () => {
    stubOwnedRun();
    const open = {
      id: 77,
      status: AttendanceSessionStatus.OPEN,
      teachingAssignment: ta,
      teachingAssignmentId: 100,
      scheduleEntryId: 1,
      sessionDate: '2026-09-14',
    };
    sessions.findOne.mockResolvedValue(open);
    await expect(
      service.createSessionFromSchedule(
        { scheduleEntryId: 1 },
        teacher,
        mondayAfter,
      ),
    ).resolves.toMatchObject({ id: 77, status: AttendanceSessionStatus.OPEN });

    const closed = { ...open, id: 88, status: AttendanceSessionStatus.CLOSED };
    sessions.findOne.mockResolvedValue(closed);
    await expect(
      service.createSessionFromSchedule(
        { scheduleEntryId: 1 },
        teacher,
        mondayAfter,
      ),
    ).resolves.toMatchObject({
      id: 88,
      status: AttendanceSessionStatus.CLOSED,
    });
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('14. concurrent duplicate key → returns existing (no 500)', async () => {
    stubOwnedRun();
    sessions.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 60,
        status: AttendanceSessionStatus.OPEN,
        teachingAssignment: ta,
        teachingAssignmentId: 100,
        scheduleEntryId: 1,
        sessionDate: '2026-09-14',
      });
    dataSource.transaction.mockRejectedValueOnce(
      Object.assign(new Error('dup'), {
        code: 'ER_DUP_ENTRY',
        message: 'UQ_attendance_sessions_schedule_anchor_date',
      }),
    );

    await expect(
      service.createSessionFromSchedule(
        { scheduleEntryId: 1 },
        teacher,
        mondayDuring,
      ),
    ).resolves.toMatchObject({ id: 60 });
  });

  it('16–21. schedule-context occurrences for actor today', async () => {
    const qb = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        classEntry(1, '07:00:00', '07:40:00', 1),
        classEntry(2, '07:40:00', '08:20:00', 2),
      ]),
    };
    scheduleEntries.createQueryBuilder.mockReturnValue(qb);
    sessions.find.mockResolvedValue([
      {
        id: 9,
        scheduleEntryId: 1,
        status: AttendanceSessionStatus.OPEN,
        sessionDate: '2026-09-14',
      },
    ]);

    const ctx = await service.getScheduleContext(teacher, {}, mondayDuring);
    expect(ctx.date).toBe('2026-09-14');
    expect(ctx.dayOfWeek).toBe(1);
    expect(ctx.occurrences).toHaveLength(1);
    expect(ctx.occurrences[0]).toMatchObject({
      anchorEntryId: 1,
      entryIds: [1, 2],
      withinStartWindow: true,
      attendanceSession: { id: 9, status: AttendanceSessionStatus.OPEN },
    });
  });

  it('missing schedule entry → 404', async () => {
    scheduleEntries.findOne.mockResolvedValue(null);
    await expect(
      service.createSessionFromSchedule(
        { scheduleEntryId: 999 },
        teacher,
        mondayDuring,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('Schedule occurrence historical protection helpers (F)', () => {
  it('25–28. used run members marked; adjacent join would touch used', async () => {
    const {
      groupScheduleOccurrences,
      usedEntryIdsFromRuns,
    } = await import('../../schedule/utils/schedule-occurrence-protection.util');
    const { ScheduleSlotType: ST } = await import(
      '../../../common/enums/schedule-slot-type.enum'
    );

    const inputs = [
      {
        id: 1,
        teachingAssignmentId: 5,
        dayOfWeek: 1,
        slotType: ST.CLASS,
        startTime: '07:00:00',
        endTime: '07:40:00',
        displayOrder: 1,
      },
      {
        id: 2,
        teachingAssignmentId: 5,
        dayOfWeek: 1,
        slotType: ST.CLASS,
        startTime: '08:00:00',
        endTime: '08:40:00',
        displayOrder: 2,
      },
    ];
    const runs = groupScheduleOccurrences(inputs);
    const used = usedEntryIdsFromRuns(runs, new Set([1]));
    expect(used.has(1)).toBe(true);
    expect(used.has(2)).toBe(false);

    const withAdjacent = [
      ...inputs,
      {
        id: -1,
        teachingAssignmentId: 5,
        dayOfWeek: 1,
        slotType: ST.CLASS,
        startTime: '07:40:00',
        endTime: '08:00:00',
        displayOrder: 3,
      },
    ];
    const joined = groupScheduleOccurrences(withAdjacent).find((r: { entryIds: number[] }) =>
      r.entryIds.includes(-1),
    );
    expect(joined?.entryIds).toEqual([1, -1, 2]);
    expect(
      joined!.entryIds.some((id: number) => id !== -1 && used.has(id)),
    ).toBe(true);
  });
});
