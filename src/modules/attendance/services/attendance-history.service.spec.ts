import { ForbiddenException } from '@nestjs/common';
import { Role } from '../../../common/enums/role.enum';
import { ScheduleSlotType } from '../../../common/enums/schedule-slot-type.enum';
import { AttendanceHistoryService } from './attendance-history.service';

describe('AttendanceHistoryService', () => {
  const qb = {
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    clone: jest.fn(),
    getCount: jest.fn(),
    getMany: jest.fn(),
    getRawMany: jest.fn(),
  };

  const attendance = {
    createQueryBuilder: jest.fn(() => qb),
  };

  const timeSlots = {
    count: jest.fn(),
  };

  const sessionsService = {
    isAdminActor: jest.fn(),
  };

  let service: AttendanceHistoryService;

  const teacher = {
    id: 10,
    email: 't@test.com',
    roles: [Role.TEACHER],
    permissions: ['attendance.view'],
    mustChangePassword: false,
  };

  const admin = {
    ...teacher,
    id: 1,
    roles: [Role.ADMIN],
    permissions: ['attendance.view'],
  };

  const student = {
    id: 501,
    email: 's@test.com',
    roles: ['Estudiante' as Role],
    permissions: ['attendance.view_own'],
    mustChangePassword: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    qb.clone.mockReturnValue(qb);
    qb.getCount.mockResolvedValue(1);
    qb.getRawMany.mockResolvedValue([{ status: 'PRESENT', count: '1' }]);
    timeSlots.count.mockResolvedValue(6);
    qb.getMany.mockResolvedValue([
      {
        id: 900,
        status: 'PRESENT',
        registrationMethod: 'MANUAL',
        registeredAt: new Date('2026-09-11T15:00:00.000Z'),
        registeredBy: {
          id: 10,
          name: 'Luis',
          first_lastname: 'Docente',
          second_lastname: null,
        },
        session: {
          id: 50,
          sessionDate: '2026-09-11',
          startedAt: new Date('2026-09-11T14:00:00.000Z'),
          scheduleEntry: {
            timeSlot: {
              lessonNumber: 3,
              startTime: '08:45:00',
              endTime: '10:15:00',
              slotType: ScheduleSlotType.CLASS,
            },
          },
          teachingAssignment: {
            id: 100,
            userId: 10,
            groupId: 20,
            offeringKind: 'SUBJECT',
            subjectId: 7,
            specialtyId: null,
            group: { name: '7-1', section: { gradeLevel: 7 } },
            subject: { name: 'Matemática' },
            specialty: null,
            user: {
              name: 'Luis',
              first_lastname: 'Docente',
              second_lastname: null,
            },
          },
        },
        student: {
          id: 501,
          national_id: '1-1111-1111',
          name: 'Ana',
          first_lastname: 'Pérez',
          second_lastname: null,
        },
      },
    ]);
    service = new AttendanceHistoryService(
      attendance as never,
      timeSlots as never,
      sessionsService as never,
    );
  });

  it('scopes non-admin teachers to their teaching assignments', async () => {
    sessionsService.isAdminActor.mockReturnValue(false);

    const page = await service.search({ page: 1, limit: 10 }, teacher);

    expect(sessionsService.isAdminActor).toHaveBeenCalledWith(teacher);
    expect(qb.andWhere).toHaveBeenCalledWith('ta.id_users = :teacherId', {
      teacherId: 10,
    });
    expect(page.total).toBe(1);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.student.fullName).toBe('Ana Pérez');
    expect(page.items[0]?.offering.name).toBe('Matemática');
    expect(page.items[0]?.registrationMethod).toBe('MANUAL');
    expect(page.items[0]?.lessonNumber).toBe(3);
    expect(page.items[0]?.lessonTotal).toBe(6);
    expect(page.items[0]?.scheduleStartTime).toBe('08:45');
    expect(page.items[0]?.registeredBy.fullName).toBe('Luis Docente');
  });

  it('scopes students to their own attendance records', async () => {
    sessionsService.isAdminActor.mockReturnValue(false);

    await service.search({ page: 1, limit: 10, studentId: 999 }, student);

    expect(qb.andWhere).toHaveBeenCalledWith(
      'a.id_users_student = :ownStudentId',
      { ownStudentId: 501 },
    );
    const teacherScopeCalls = qb.andWhere.mock.calls.filter(
      (c: unknown[]) => c[0] === 'ta.id_users = :teacherId',
    );
    expect(teacherScopeCalls).toHaveLength(0);
  });

  it('does not scope admin actors by teacher id', async () => {
    sessionsService.isAdminActor.mockReturnValue(true);

    await service.search(
      {
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        groupId: 20,
        status: 'LATE' as never,
        registrationMethod: 'TOKEN' as never,
        search: 'ana',
      },
      admin,
    );

    const teacherScopeCalls = qb.andWhere.mock.calls.filter(
      (c: unknown[]) => c[0] === 'ta.id_users = :teacherId',
    );
    expect(teacherScopeCalls).toHaveLength(0);
    expect(qb.andWhere).toHaveBeenCalledWith(
      'session.session_date >= :startDate',
      { startDate: '2026-09-01' },
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      'session.session_date <= :endDate',
      { endDate: '2026-09-30' },
    );
    expect(qb.andWhere).toHaveBeenCalledWith('ta.id_groups = :groupId', {
      groupId: 20,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('a.status = :status', {
      status: 'LATE',
    });
    expect(qb.andWhere).toHaveBeenCalledWith(
      'a.registration_method = :registrationMethod',
      { registrationMethod: 'TOKEN' },
    );
  });

  it('paginates with totalPages', async () => {
    sessionsService.isAdminActor.mockReturnValue(true);
    qb.getCount.mockResolvedValue(55);

    const page = await service.search({ page: 2, limit: 25 }, admin);

    expect(qb.skip).toHaveBeenCalledWith(25);
    expect(qb.take).toHaveBeenCalledWith(25);
    expect(page.page).toBe(2);
    expect(page.limit).toBe(25);
    expect(page.total).toBe(55);
    expect(page.totalPages).toBe(3);
  });

  it('summarizes counts and attendance percent', async () => {
    sessionsService.isAdminActor.mockReturnValue(true);
    qb.getRawMany.mockResolvedValue([
      { status: 'PRESENT', count: '26' },
      { status: 'LATE', count: '3' },
      { status: 'ABSENT', count: '2' },
      { status: 'JUSTIFIED', count: '1' },
    ]);

    const summary = await service.summarize({}, admin);

    expect(summary.total).toBe(32);
    expect(summary.present).toBe(26);
    expect(summary.late).toBe(3);
    expect(summary.absent).toBe(2);
    expect(summary.justified).toBe(1);
    expect(summary.attendancePercent).toBe(93.8);
    expect(summary.band).toBe('Excelente');
  });

  it('rejects actors without history access', async () => {
    sessionsService.isAdminActor.mockReturnValue(false);
    const stranger = {
      id: 99,
      email: 'x@test.com',
      roles: [Role.GUARDIAN],
      permissions: [] as string[],
      mustChangePassword: false,
    };

    await expect(service.search({}, stranger)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
