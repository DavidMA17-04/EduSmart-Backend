import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AttendanceRegistrationMethod } from '../../../common/enums/attendance-registration-method.enum';
import { AttendanceSessionStatus } from '../../../common/enums/attendance-session-status.enum';
import { AttendanceStatus } from '../../../common/enums/attendance-status.enum';
import { Role } from '../../../common/enums/role.enum';
import {
  AttendanceTokenService,
  costaRicaLocalToUtcDate,
} from './attendance-token.service';

describe('AttendanceTokenService', () => {
  const sessions = {
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const attendance = {
    findOne: jest.fn(),
  };
  const sessionsService = {
    assertCanManageTeachingAssignment: jest.fn(),
  };
  const recordsService = {
    loadRosterUsers: jest.fn(),
  };

  const sessionRepo = {
    findOne: jest.fn(),
  };
  const attendanceRepo = {
    findOne: jest.fn(),
    create: jest.fn((data) => ({ ...data, id: 77 })),
    save: jest.fn(async (row) => ({ ...row, id: row.id ?? 77 })),
  };
  const enrollmentRepo = {};
  const auditRepo = {
    create: jest.fn((data) => ({ ...data })),
    save: jest.fn(async (row) => row),
  };

  const dataSource = {
    transaction: jest.fn(async (fn: (m: unknown) => Promise<unknown>) => {
      const manager = {
        getRepository: (entity: { name?: string }) => {
          const name = entity.name ?? String(entity);
          if (name.includes('AttendanceSession')) return sessionRepo;
          if (name.includes('Attendance') && !name.includes('Session')) {
            return attendanceRepo;
          }
          if (name.includes('GroupEnrollment')) return enrollmentRepo;
          if (name.includes('AuditLog')) return auditRepo;
          return attendanceRepo;
        },
      };
      return fn(manager);
    }),
    getRepository: jest.fn(() => auditRepo),
  };

  let service: AttendanceTokenService;

  const teacher = {
    id: 10,
    email: 't@test.com',
    roles: [Role.TEACHER],
    permissions: ['attendance.edit'],
    mustChangePassword: false,
  };

  const student = {
    id: 501,
    email: 's@test.com',
    roles: [Role.STUDENT],
    permissions: ['schedules.view_own'],
    mustChangePassword: false,
  };

  const openSession = {
    id: 50,
    status: AttendanceSessionStatus.OPEN,
    sessionDate: '2026-09-11',
    attendanceToken: null,
    attendanceTokenExpiresAt: null,
    teachingAssignment: {
      id: 100,
      userId: 10,
      groupId: 20,
      group: { name: '7-1' },
      offeringKind: 'SUBJECT',
      subject: { name: 'Matemática' },
      specialty: null,
    },
    scheduleEntry: {
      timeSlot: { endTime: '10:20:00' },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AttendanceTokenService(
      sessions as never,
      attendance as never,
      sessionsService as never,
      recordsService as never,
      dataSource as never,
    );
  });

  it('generates a token for an OPEN session with schedule end expiry', async () => {
    sessions.findOne.mockResolvedValue({ ...openSession });
    sessions.save.mockImplementation(async (row) => row);

    const result = await service.generateToken(50, teacher);

    expect(sessionsService.assertCanManageTeachingAssignment).toHaveBeenCalled();
    expect(result.sessionId).toBe(50);
    expect(result.token).toMatch(/^[A-Z0-9]{8}$/);
    expect(result.expiresAt).toEqual(
      costaRicaLocalToUtcDate('2026-09-11', '10:20:00'),
    );
    expect(sessions.save).toHaveBeenCalled();
  });

  it('rejects token generation when session is CLOSED', async () => {
    sessions.findOne.mockResolvedValue({
      ...openSession,
      status: AttendanceSessionStatus.CLOSED,
    });

    await expect(service.generateToken(50, teacher)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('redeems a valid token for an enrolled student as PRESENT/TOKEN', async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    sessionRepo.findOne.mockResolvedValue({
      ...openSession,
      attendanceToken: 'ABCD1234',
      attendanceTokenExpiresAt: expiresAt,
    });
    attendanceRepo.findOne.mockResolvedValue(null);
    recordsService.loadRosterUsers.mockResolvedValue([{ id: 501 }]);

    const result = await service.redeemToken({ token: 'ABCD1234' }, student);

    expect(result.status).toBe(AttendanceStatus.PRESENT);
    expect(result.registrationMethod).toBe(
      AttendanceRegistrationMethod.TOKEN,
    );
    expect(result.studentUserId).toBe(501);
    expect(result.alreadyRedeemed).toBe(false);
    expect(result.offeringName).toBe('Matemática');
    expect(attendanceRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        registrationMethod: AttendanceRegistrationMethod.TOKEN,
        status: AttendanceStatus.PRESENT,
        registeredByUserId: 501,
      }),
    );
  });

  it('forbids non-students from redeeming', async () => {
    await expect(
      service.redeemToken({ token: 'ABCD1234' }, teacher),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('accepts institutional Estudiante role name for redeem', async () => {
    sessionRepo.findOne.mockResolvedValue({
      ...openSession,
      attendanceToken: 'ABCD1234',
      attendanceTokenExpiresAt: new Date(Date.now() + 60_000),
    });
    recordsService.loadRosterUsers.mockResolvedValue([{ id: 501 }]);
    attendanceRepo.findOne.mockResolvedValue(null);

    const result = await service.redeemToken(
      { token: 'ABCD1234' },
      { ...student, roles: ['Estudiante'] as unknown as Role[] },
    );
    expect(result.status).toBe(AttendanceStatus.PRESENT);
  });

  it('rejects expired tokens', async () => {
    sessionRepo.findOne.mockResolvedValue({
      ...openSession,
      attendanceToken: 'ABCD1234',
      attendanceTokenExpiresAt: new Date(Date.now() - 1000),
    });

    await expect(
      service.redeemToken({ token: 'ABCD1234' }, student),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('forbids students not in roster', async () => {
    sessionRepo.findOne.mockResolvedValue({
      ...openSession,
      attendanceToken: 'ABCD1234',
      attendanceTokenExpiresAt: new Date(Date.now() + 60_000),
    });
    recordsService.loadRosterUsers.mockResolvedValue([{ id: 999 }]);

    await expect(
      service.redeemToken({ token: 'ABCD1234' }, student),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects duplicate attendance for same session', async () => {
    sessionRepo.findOne.mockResolvedValue({
      ...openSession,
      attendanceToken: 'ABCD1234',
      attendanceTokenExpiresAt: new Date(Date.now() + 60_000),
      teachingAssignment: {
        id: 100,
        userId: 10,
        groupId: 20,
        group: { name: '7-1' },
        offeringKind: 'SUBJECT',
        subject: { name: 'Matemática' },
      },
    });
    recordsService.loadRosterUsers.mockResolvedValue([{ id: 501 }]);
    attendanceRepo.findOne.mockResolvedValue({
      id: 1,
      studentUserId: 501,
      status: AttendanceStatus.PRESENT,
      registrationMethod: AttendanceRegistrationMethod.TOKEN,
      registeredAt: new Date(),
    });

    const result = await service.redeemToken({ token: 'ABCD1234' }, student);
    expect(result.alreadyRedeemed).toBe(true);
    expect(result.status).toBe(AttendanceStatus.PRESENT);
  });

  it('returns not found for unknown token', async () => {
    sessionRepo.findOne.mockResolvedValue(null);

    await expect(
      service.redeemToken({ token: 'NOPE0000' }, student),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('costaRicaLocalToUtcDate', () => {
  it('maps CR local wall time with fixed UTC-6 offset', () => {
    const d = costaRicaLocalToUtcDate('2026-09-11', '10:20:00');
    expect(d.toISOString()).toBe('2026-09-11T16:20:00.000Z');
  });
});
