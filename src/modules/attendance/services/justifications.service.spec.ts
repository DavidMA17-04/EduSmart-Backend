import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { AttendanceJustificationStatus } from '../../../common/enums/attendance-justification-status.enum';
import { AttendanceStatus } from '../../../common/enums/attendance-status.enum';
import { JustificationStatus } from '../../../common/enums/justification-status.enum';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { Role } from '../../../common/enums/role.enum';
import { AuditLog } from '../../administrative/users/entities/audit-log.entity';
import { JustificationReviewDecision } from '../dto/review-justification.dto';
import { AbsenceJustification } from '../entities/absence-justification.entity';
import { Attendance } from '../entities/attendance.entity';
import { JustificationEvidence } from '../entities/justification-evidence.entity';
import { JustificationsService } from './justifications.service';

describe('JustificationsService state machine', () => {
  const justificationRepo = {
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => ({ id: 1, ...x })),
    createQueryBuilder: jest.fn(),
    findOneByOrFail: jest.fn(),
  };
  const evidenceRepo = {
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => ({ id: 10, createdAt: new Date(), ...x })),
  };
  const attendanceRepo = {
    findOne: jest.fn(),
    save: jest.fn(async (x) => x),
    findOneByOrFail: jest.fn(),
  };
  const guardianLinksRepo = {
    count: jest.fn(),
    find: jest.fn(async (): Promise<Array<{ studentUserId: number }>> => []),
  };
  const auditRepo = {
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => x),
  };
  const manager = {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === AbsenceJustification) return justificationRepo;
      if (entity === JustificationEvidence) return evidenceRepo;
      if (entity === Attendance) return attendanceRepo;
      if (entity === AuditLog) return auditRepo;
      throw new Error('unexpected repository');
    }),
  };
  const dataSource = {
    transaction: jest.fn(async (cb: (m: typeof manager) => unknown) => cb(manager)),
  };

  const service = new JustificationsService(
    justificationRepo as never,
    evidenceRepo as never,
    attendanceRepo as never,
    guardianLinksRepo as never,
    dataSource as never,
  );

  const studentActor = {
    id: 5,
    email: 's@test.com',
    roles: [],
    permissions: [PERMISSIONS.ATTENDANCE_JUSTIFY, PERMISSIONS.ATTENDANCE_READ],
    mustChangePassword: false,
  };

  const reviewer = {
    id: 9,
    email: 'admin@test.com',
    roles: [Role.ADMIN],
    permissions: [PERMISSIONS.ATTENDANCE_REVIEW, PERMISSIONS.ATTENDANCE_READ],
    mustChangePassword: false,
  };

  const teacher = {
    id: 30,
    email: 'docente@test.com',
    roles: [Role.TEACHER],
    permissions: [PERMISSIONS.ATTENDANCE_REVIEW, PERMISSIONS.ATTENDANCE_READ],
    mustChangePassword: false,
  };

  const guardianActor = {
    id: 7,
    email: 'encargado@test.com',
    roles: [],
    permissions: [PERMISSIONS.ATTENDANCE_JUSTIFY, PERMISSIONS.ATTENDANCE_READ],
    mustChangePassword: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    justificationRepo.findOne.mockReset();
    justificationRepo.save.mockReset().mockImplementation(async (x) => ({ id: 1, ...x }));
    justificationRepo.create.mockReset().mockImplementation((x) => x);
    attendanceRepo.findOne.mockReset();
    attendanceRepo.save.mockReset().mockImplementation(async (x) => x);
    attendanceRepo.findOneByOrFail.mockReset();
    evidenceRepo.create.mockReset().mockImplementation((x) => x);
    evidenceRepo.save.mockReset().mockImplementation(async (x) => ({
      id: 10,
      createdAt: new Date(),
      ...x,
    }));
    guardianLinksRepo.count.mockReset().mockResolvedValue(0);
    guardianLinksRepo.find.mockReset().mockResolvedValue([]);
    auditRepo.save.mockReset().mockImplementation(async (x) => x);
  });

  it('createJustification rejects non-ABSENT', async () => {
    attendanceRepo.findOne.mockResolvedValue({
      id: 1,
      status: AttendanceStatus.PRESENT,
      studentUserId: 5,
    });
    await expect(
      service.createJustification(
        { attendanceId: 1, reason: 'Motivo suficientemente largo' },
        studentActor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createJustification rejects active PENDING/APPROVED', async () => {
    attendanceRepo.findOne.mockResolvedValue({
      id: 1,
      status: AttendanceStatus.ABSENT,
      studentUserId: 5,
      student: { name: 'A', first_lastname: 'B', national_id: '1' },
      session: {
        sessionDate: '2026-09-01',
        teachingAssignment: { groupId: 1, group: { name: '10-1' } },
      },
    });
    justificationRepo.findOne
      .mockResolvedValueOnce({ id: 99, status: JustificationStatus.PENDING })
      .mockResolvedValueOnce(null);
    await expect(
      service.createJustification(
        { attendanceId: 1, reason: 'Motivo suficientemente largo' },
        studentActor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('review APPROVED sets attendance status and justification_status JUSTIFIED', async () => {
    const pending = {
      id: 3,
      attendanceId: 7,
      status: JustificationStatus.PENDING,
      reason: 'motivo largo suficiente',
      evidences: [],
      attendance: {
        id: 7,
        studentUserId: 5,
        student: { name: 'A', first_lastname: 'B', national_id: '1' },
        session: {
          sessionDate: '2026-09-01',
          teachingAssignment: {
            groupId: 1,
            group: { name: '10-1' },
            offeringKind: null,
          },
        },
      },
    };
    justificationRepo.findOne.mockImplementation(async () => ({
      ...pending,
      status: JustificationStatus.PENDING,
      attendance: pending.attendance,
      evidences: [],
    }));
    attendanceRepo.findOneByOrFail.mockResolvedValue({
      id: 7,
      status: AttendanceStatus.ABSENT,
      justificationStatus: AttendanceJustificationStatus.PENDING,
    });

    await service.reviewJustification(
      3,
      { status: JustificationReviewDecision.APPROVED },
      reviewer,
    );

    expect(justificationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: JustificationStatus.APPROVED,
        reviewedByUserId: 9,
      }),
    );
    expect(attendanceRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        justificationStatus: AttendanceJustificationStatus.JUSTIFIED,
        status: AttendanceStatus.JUSTIFIED,
      }),
    );
    expect(auditRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'JUSTIFICATION_APPROVED',
        actorId: 9,
        entityId: '3',
        before: expect.objectContaining({ attendanceStatus: AttendanceStatus.ABSENT }),
        after: expect.objectContaining({ attendanceStatus: AttendanceStatus.JUSTIFIED }),
      }),
    );
  });

  function pendingForTeacher(teacherUserId: number) {
    return {
      id: 4,
      attendanceId: 8,
      status: JustificationStatus.PENDING,
      reason: 'motivo largo suficiente',
      evidences: [],
      attendance: {
        id: 8,
        studentUserId: 5,
        student: { name: 'A', first_lastname: 'B', national_id: '1' },
        session: {
          sessionDate: '2026-09-01',
          teachingAssignment: {
            userId: teacherUserId,
            groupId: 1,
            group: { name: '10-1' },
            offeringKind: null,
          },
        },
      },
    };
  }

  it('review REJECTED with notes keeps ABSENT and sets REJECTED', async () => {
    justificationRepo.findOne.mockImplementation(async () => pendingForTeacher(30));
    attendanceRepo.findOneByOrFail.mockResolvedValue({
      id: 8,
      status: AttendanceStatus.ABSENT,
      justificationStatus: AttendanceJustificationStatus.PENDING,
    });

    await service.reviewJustification(
      4,
      { status: JustificationReviewDecision.REJECTED, decisionNotes: 'Sin respaldo' },
      teacher,
    );

    expect(attendanceRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: AttendanceStatus.ABSENT,
        justificationStatus: AttendanceJustificationStatus.REJECTED,
      }),
    );
    expect(auditRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'JUSTIFICATION_REJECTED', actorId: 30 }),
    );
  });

  it('teacher reviewing outside own teaching assignment → 403', async () => {
    justificationRepo.findOne.mockResolvedValue(pendingForTeacher(31));

    await expect(
      service.reviewJustification(4, { status: JustificationReviewDecision.APPROVED }, teacher),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'JUSTIFICATION_REVIEW_NOT_ALLOWED' }),
    });
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('counselor is not an institution-wide reviewer → 403 outside own assignments', async () => {
    justificationRepo.findOne.mockResolvedValue(pendingForTeacher(31));
    const counselor = { ...teacher, id: 40, roles: [Role.COUNSELOR] };

    await expect(
      service.reviewJustification(4, { status: JustificationReviewDecision.APPROVED }, counselor),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'JUSTIFICATION_REVIEW_NOT_ALLOWED' }),
    });
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('review REJECTED without notes → BadRequest', async () => {
    justificationRepo.findOne.mockResolvedValue({
      id: 3,
      attendanceId: 7,
      status: JustificationStatus.PENDING,
      evidences: [],
      attendance: {
        studentUserId: 5,
        student: { name: 'A', first_lastname: 'B', national_id: '1' },
        session: {
          sessionDate: '2026-09-01',
          teachingAssignment: { groupId: 1, group: { name: '10-1' } },
        },
      },
    });
    await expect(
      service.reviewJustification(3, { status: JustificationReviewDecision.REJECTED }, reviewer),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('re-dictamen on APPROVED → BadRequest', async () => {
    justificationRepo.findOne.mockResolvedValue({
      id: 3,
      status: JustificationStatus.APPROVED,
      evidences: [],
      attendance: {
        studentUserId: 5,
        student: { name: 'A', first_lastname: 'B', national_id: '1' },
        session: {
          sessionDate: '2026-09-01',
          teachingAssignment: { groupId: 1, group: { name: '10-1' } },
        },
      },
    });
    await expect(
      service.reviewJustification(3, { status: JustificationReviewDecision.APPROVED }, reviewer),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'JUSTIFICATION_NOT_PENDING' }),
    });
  });

  it('AttendanceStatus incluye JUSTIFIED además de PRESENT/ABSENT/LATE', () => {
    expect(Object.values(AttendanceStatus)).toEqual([
      'PRESENT',
      'ABSENT',
      'LATE',
      'JUSTIFIED',
    ]);
  });

  function absentMark(studentUserId: number) {
    return {
      id: 11,
      status: AttendanceStatus.ABSENT,
      studentUserId,
      student: { name: 'Hijo', first_lastname: 'Demo', national_id: '9-9999-9999' },
      session: {
        sessionDate: '2026-09-10',
        teachingAssignment: {
          groupId: 1,
          group: { name: '10-1' },
          offeringKind: null,
        },
      },
    };
  }

  function loadedJustification(attendanceId: number, studentUserId: number) {
    return {
      id: 1,
      attendanceId,
      status: JustificationStatus.PENDING,
      reason: 'Motivo suficientemente largo',
      decisionNotes: null,
      createdAt: new Date(),
      reviewedAt: null,
      reviewedByUserId: null,
      evidences: [],
      attendance: {
        id: attendanceId,
        studentUserId,
        student: { name: 'Hijo', first_lastname: 'Demo', national_id: '9-9999-9999' },
        session: {
          sessionDate: '2026-09-10',
          teachingAssignment: {
            groupId: 1,
            group: { name: '10-1' },
            offeringKind: null,
          },
        },
      },
    };
  }

  it('guardian WITH link justifies representado absence', async () => {
    attendanceRepo.findOne.mockResolvedValue(absentMark(21));
    guardianLinksRepo.count.mockResolvedValue(1);
    justificationRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(loadedJustification(11, 21));

    const view = await service.createJustification(
      { attendanceId: 11, reason: 'Motivo suficientemente largo' },
      guardianActor,
    );

    expect(view.status).toBe(JustificationStatus.PENDING);
    expect(guardianLinksRepo.count).toHaveBeenCalledWith({
      where: { guardianUserId: 7, studentUserId: 21 },
    });
  });

  it('guardian WITHOUT link justifying third party → 403', async () => {
    attendanceRepo.findOne.mockResolvedValue(absentMark(21));
    guardianLinksRepo.count.mockResolvedValue(0);

    await expect(
      service.createJustification(
        { attendanceId: 11, reason: 'Motivo suficientemente largo' },
        guardianActor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(justificationRepo.save).not.toHaveBeenCalled();
  });

  it('student justifying another student → 403 (no escalation)', async () => {
    attendanceRepo.findOne.mockResolvedValue(absentMark(99));
    guardianLinksRepo.count.mockResolvedValue(0);

    await expect(
      service.createJustification(
        { attendanceId: 11, reason: 'Motivo suficientemente largo' },
        studentActor,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'JUSTIFICATION_NOT_ALLOWED' }),
    });
  });

  it('createJustification runs in a transaction and audits JUSTIFICATION_CREATED', async () => {
    attendanceRepo.findOne.mockResolvedValue(absentMark(5));
    justificationRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(loadedJustification(11, 5));

    await service.createJustification(
      { attendanceId: 11, reason: 'Motivo suficientemente largo' },
      studentActor,
    );

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(attendanceRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ justificationStatus: AttendanceJustificationStatus.PENDING }),
    );
    expect(auditRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'JUSTIFICATION_CREATED', actorId: 5 }),
    );
  });

  describe('getJustifications scope', () => {
    function mockQueryBuilder() {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn(async () => [[], 0]),
      };
      justificationRepo.createQueryBuilder.mockReturnValue(qb);
      return qb;
    }

    it('admin sees everything', async () => {
      const qb = mockQueryBuilder();
      await service.getJustifications({}, reviewer);
      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it('teacher reviewer is limited to own teaching assignments', async () => {
      const qb = mockQueryBuilder();
      await service.getJustifications({}, teacher);
      expect(qb.andWhere).toHaveBeenCalledWith('ta.id_users = :scopeTeacherId', {
        scopeTeacherId: 30,
      });
    });

    it('guardian sees own and represented students', async () => {
      const qb = mockQueryBuilder();
      guardianLinksRepo.find.mockResolvedValue([{ studentUserId: 21 }, { studentUserId: 22 }]);
      await service.getJustifications({}, guardianActor);
      expect(qb.andWhere).toHaveBeenCalledWith('a.id_users_student IN (:...scopeStudentIds)', {
        scopeStudentIds: [7, 21, 22],
      });
    });
  });

  describe('getEvidenceFile', () => {
    it('returns 404 when the actor cannot see the justification', async () => {
      justificationRepo.findOne.mockResolvedValue({
        ...loadedJustification(11, 99),
        evidences: [{ id: 50, storagePath: 'justifications/x.pdf' }],
      });
      await expect(service.getEvidenceFile(1, 50, studentActor)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'EVIDENCE_NOT_FOUND' }),
      });
    });

    it('returns 404 for storage paths outside the justifications folder', async () => {
      justificationRepo.findOne.mockResolvedValue({
        ...loadedJustification(11, 5),
        evidences: [{ id: 50, storagePath: '../package.json', fileName: 'x', mimeType: 'x' }],
      });
      await expect(service.getEvidenceFile(1, 50, studentActor)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'EVIDENCE_NOT_FOUND' }),
      });
    });
  });

  it('list / justifiable-absences without view|justify|review → 403', async () => {
    const noAccess = { ...studentActor, permissions: [PERMISSIONS.ATTENDANCE_EDIT] };
    await expect(service.getJustifications({}, noAccess)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.getJustifiableAbsences({}, noAccess)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('list allowed with only attendance.view_own (student without view)', async () => {
    const qb = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    justificationRepo.createQueryBuilder.mockReturnValue(qb);
    const ownOnly = { ...studentActor, permissions: [PERMISSIONS.ATTENDANCE_VIEW_OWN] };
    await expect(service.getJustifications({}, ownOnly)).resolves.toMatchObject({
      data: [],
      total: 0,
    });
  });

  it('justifiable-absences allowed with only attendance.justify (student without view)', async () => {
    const qb = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    (attendanceRepo as unknown as { createQueryBuilder: jest.Mock }).createQueryBuilder = jest
      .fn()
      .mockReturnValue(qb);
    const justifyOnly = { ...studentActor, permissions: [PERMISSIONS.ATTENDANCE_JUSTIFY] };
    await expect(service.getJustifiableAbsences({}, justifyOnly)).resolves.toEqual([]);
    expect(qb.andWhere).toHaveBeenCalledWith('a.id_users_student IN (:...studentIds)', {
      studentIds: [5],
    });
  });
});
