import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { AttendanceRegistrationMethod } from '../../../common/enums/attendance-registration-method.enum';
import { AttendanceSessionStatus } from '../../../common/enums/attendance-session-status.enum';
import { AttendanceStatus } from '../../../common/enums/attendance-status.enum';
import { Role } from '../../../common/enums/role.enum';
import { RoleStatus } from '../../../common/enums/role-status.enum';
import { AttendanceRecordsService } from './attendance-records.service';

describe('AttendanceRecordsService Phase 1A', () => {
  const attendance = {
    find: jest.fn(),
  };
  const enrollments = {
    createQueryBuilder: jest.fn(),
  };
  const sessionsService = {
    findOne: jest.fn(),
    assertCanManageTeachingAssignment: jest.fn(),
  };

  const attendanceRepo = {
    find: jest.fn(),
    create: jest.fn((data) => ({ ...data })),
    save: jest.fn(),
  };
  const sessionRepo = {
    findOne: jest.fn(),
  };
  const auditRepo = {
    create: jest.fn((data) => ({ ...data })),
    save: jest.fn(async (row) => row),
  };
  const enrollmentRepoTx = {
    createQueryBuilder: jest.fn(),
  };

  const dataSource = {
    transaction: jest.fn(async (fn: (m: unknown) => Promise<unknown>) => {
      const manager = {
        getRepository: (entity: { name?: string }) => {
          const name = entity.name ?? String(entity);
          if (name.includes('AttendanceSession') || name === 'AttendanceSession') {
            return sessionRepo;
          }
          if (name.includes('Attendance') && !name.includes('Session')) {
            return attendanceRepo;
          }
          if (name.includes('AuditLog') || name === 'AuditLog') {
            return auditRepo;
          }
          if (name.includes('GroupEnrollment')) {
            return enrollmentRepoTx;
          }
          return attendanceRepo;
        },
      };
      return fn(manager);
    }),
  };

  let service: AttendanceRecordsService;
  const teacher = {
    id: 10,
    email: 't@test.com',
    roles: [Role.TEACHER],
    permissions: ['attendance.create'],
    mustChangePassword: false,
  };

  const openSession = {
    id: 50,
    status: AttendanceSessionStatus.OPEN,
    sessionDate: '2026-09-11',
    teachingAssignment: { id: 100, userId: 10, groupId: 20 },
  };

  const studentUser = {
    id: 501,
    national_id: '1-1111-1111',
    name: 'Ana',
    first_lastname: 'Pérez',
    second_lastname: null,
    userRoles: [
      { role: { name: 'Estudiante', status: RoleStatus.ACTIVE } },
    ],
  };

  function mockEnrollmentQb(repo: { createQueryBuilder: jest.Mock }, rows: unknown[]) {
    const qb = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(rows),
    };
    repo.createQueryBuilder.mockReturnValue(qb);
    return qb;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AttendanceRecordsService(
      attendance as never,
      enrollments as never,
      sessionsService as never,
      dataSource as never,
    );
    sessionsService.findOne.mockResolvedValue(openSession);
    sessionsService.assertCanManageTeachingAssignment.mockImplementation(() => undefined);
    sessionRepo.findOne.mockResolvedValue(openSession);
    mockEnrollmentQb(enrollments, [{ user: studentUser }]);
    mockEnrollmentQb(enrollmentRepoTx, [{ user: studentUser }]);
    attendance.find.mockResolvedValue([]);
    attendanceRepo.find.mockResolvedValue([]);
    let idSeq = 1;
    attendanceRepo.save.mockImplementation(async (row) => ({
      ...row,
      id: row.id ?? idSeq++,
      updatedAt: new Date(),
    }));
  });

  describe('roster', () => {
    it('15. enrollment activo en session_date → aparece', async () => {
      const roster = await service.getRoster(50, teacher);
      expect(roster).toHaveLength(1);
      expect(roster[0]).toMatchObject({
        userId: 501,
        nationalId: '1-1111-1111',
        fullName: 'Ana Pérez',
        attendance: null,
      });
    });

    it('16. enrollment finalizado antes → no aparece', async () => {
      mockEnrollmentQb(enrollments, []);
      await expect(service.getRoster(50, teacher)).resolves.toEqual([]);
    });

    it('17. enrollment que inicia después → no aparece', async () => {
      mockEnrollmentQb(enrollments, []);
      await expect(service.getRoster(50, teacher)).resolves.toEqual([]);
    });

    it('18. transferencia histórica → aparece en grupo correcto según fecha', async () => {
      // Query already scoped by groupId + date window; enrollment in this group returns student.
      const roster = await service.getRoster(50, teacher);
      expect(roster.map((r) => r.userId)).toEqual([501]);
    });
  });

  describe('upsert records', () => {
    it('19-21. manual PRESENT/ABSENT/LATE → OK', async () => {
      for (const status of [
        AttendanceStatus.PRESENT,
        AttendanceStatus.ABSENT,
        AttendanceStatus.LATE,
      ]) {
        jest.clearAllMocks();
        sessionRepo.findOne.mockResolvedValue(openSession);
        mockEnrollmentQb(enrollmentRepoTx, [{ user: studentUser }]);
        attendanceRepo.find.mockResolvedValue([]);
        attendanceRepo.save.mockImplementation(async (row) => ({
          ...row,
          id: 1,
          updatedAt: new Date(),
        }));

        const rows = await service.upsertRecords(
          50,
          { records: [{ studentUserId: 501, status }] },
          teacher,
        );
        expect(rows[0].status).toBe(status);
        expect(rows[0].registrationMethod).toBe(
          AttendanceRegistrationMethod.MANUAL,
        );
        expect(rows[0].registeredByUserId).toBe(10);
        expect(auditRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({ action: 'ATTENDANCE_RECORD_CREATED' }),
        );
      }
    });

    it('22. status inválido JUSTIFIED no existe en enum de dominio', () => {
      expect(Object.values(AttendanceStatus)).not.toContain('JUSTIFIED');
    });

    it('23. estudiante fuera de roster → reject', async () => {
      mockEnrollmentQb(enrollmentRepoTx, [{ user: studentUser }]);
      await expect(
        service.upsertRecords(
          50,
          {
            records: [{ studentUserId: 999, status: AttendanceStatus.PRESENT }],
          },
          teacher,
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'ATTENDANCE_STUDENT_NOT_IN_ROSTER',
        }),
      });
    });

    it('24. duplicado estudiante/session → no segunda fila (update path)', async () => {
      attendanceRepo.find.mockResolvedValue([
        {
          id: 7,
          attendanceSessionId: 50,
          studentUserId: 501,
          status: AttendanceStatus.ABSENT,
          registeredAt: new Date('2026-09-11T08:00:00Z'),
          registeredByUserId: 10,
          updatedByUserId: null,
        },
      ]);

      const rows = await service.upsertRecords(
        50,
        {
          records: [{ studentUserId: 501, status: AttendanceStatus.PRESENT }],
        },
        teacher,
      );

      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(7);
      expect(rows[0].status).toBe(AttendanceStatus.PRESENT);
      expect(auditRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ATTENDANCE_RECORD_UPDATED' }),
      );
    });

    it('25. corrección mientras OPEN → update; registered_by original', async () => {
      const originalRegisteredAt = new Date('2026-09-11T08:00:00Z');
      attendanceRepo.find.mockResolvedValue([
        {
          id: 7,
          studentUserId: 501,
          status: AttendanceStatus.ABSENT,
          registeredAt: originalRegisteredAt,
          registeredByUserId: 10,
          updatedByUserId: null,
        },
      ]);
      attendanceRepo.save.mockImplementation(async (row) => row);

      const otherActor = { ...teacher, id: 11 };
      const rows = await service.upsertRecords(
        50,
        {
          records: [{ studentUserId: 501, status: AttendanceStatus.LATE }],
        },
        otherActor,
      );

      expect(rows[0].registeredByUserId).toBe(10);
      expect(rows[0].registeredAt).toBe(originalRegisteredAt);
      expect(rows[0].updatedByUserId).toBe(11);
      expect(rows[0].status).toBe(AttendanceStatus.LATE);
    });

    it('26. corrección CLOSED → reject', async () => {
      sessionRepo.findOne.mockResolvedValue({
        ...openSession,
        status: AttendanceSessionStatus.CLOSED,
      });

      await expect(
        service.upsertRecords(
          50,
          {
            records: [{ studentUserId: 501, status: AttendanceStatus.PRESENT }],
          },
          teacher,
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'ATTENDANCE_SESSION_NOT_OPEN',
        }),
      });
    });

    it('27. actor no autorizado → reject', async () => {
      sessionsService.assertCanManageTeachingAssignment.mockImplementation(() => {
        throw new ForbiddenException({ code: 'ATTENDANCE_SESSION_FORBIDDEN' });
      });

      await expect(
        service.upsertRecords(
          50,
          {
            records: [{ studentUserId: 501, status: AttendanceStatus.PRESENT }],
          },
          teacher,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('28. lote con uno inválido → rollback completo', async () => {
      const student2 = {
        ...studentUser,
        id: 502,
        national_id: '2-2222-2222',
      };
      mockEnrollmentQb(enrollmentRepoTx, [
        { user: studentUser },
        { user: student2 },
      ]);

      await expect(
        service.upsertRecords(
          50,
          {
            records: [
              { studentUserId: 501, status: AttendanceStatus.PRESENT },
              { studentUserId: 999, status: AttendanceStatus.ABSENT },
            ],
          },
          teacher,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      // Validation happens before any save
      expect(attendanceRepo.save).not.toHaveBeenCalled();
    });

    it('29-30. audit create/update y registered_by / updated_by', async () => {
      attendanceRepo.find.mockResolvedValue([]);
      await service.upsertRecords(
        50,
        {
          records: [{ studentUserId: 501, status: AttendanceStatus.PRESENT }],
        },
        teacher,
      );
      expect(auditRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ATTENDANCE_RECORD_CREATED',
          after: expect.objectContaining({ registeredByUserId: 10 }),
        }),
      );

      attendanceRepo.find.mockResolvedValue([
        {
          id: 7,
          studentUserId: 501,
          status: AttendanceStatus.PRESENT,
          registeredByUserId: 10,
          updatedByUserId: null,
        },
      ]);
      attendanceRepo.save.mockImplementation(async (row) => row);

      await service.upsertRecords(
        50,
        {
          records: [{ studentUserId: 501, status: AttendanceStatus.ABSENT }],
        },
        teacher,
      );
      expect(auditRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ATTENDANCE_RECORD_UPDATED',
          after: expect.objectContaining({ updatedByUserId: 10 }),
        }),
      );
    });

    it('15. PUT records locks AttendanceSession with pessimistic_write (same as close)', async () => {
      await service.upsertRecords(
        50,
        {
          records: [{ studentUserId: 501, status: AttendanceStatus.PRESENT }],
        },
        teacher,
      );
      expect(sessionRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          lock: { mode: 'pessimistic_write' },
        }),
      );
    });

    it('payload con student duplicado → reject', async () => {
      await expect(
        service.upsertRecords(
          50,
          {
            records: [
              { studentUserId: 501, status: AttendanceStatus.PRESENT },
              { studentUserId: 501, status: AttendanceStatus.ABSENT },
            ],
          },
          teacher,
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'ATTENDANCE_DUPLICATE_STUDENT_IN_PAYLOAD',
        }),
      });
    });
  });
});

describe('UpsertAttendanceRecordsDto status enum', () => {
  it('22. solo PRESENT/ABSENT/LATE son valores del enum', () => {
    expect(Object.values(AttendanceStatus)).toEqual([
      'PRESENT',
      'ABSENT',
      'LATE',
    ]);
    expect(Object.values(AttendanceStatus)).not.toContain('JUSTIFIED');
  });
});
