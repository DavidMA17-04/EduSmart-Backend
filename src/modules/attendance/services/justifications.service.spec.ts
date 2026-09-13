import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { AttendanceJustificationStatus } from '../../../common/enums/attendance-justification-status.enum';
import { AttendanceStatus } from '../../../common/enums/attendance-status.enum';
import { JustificationStatus } from '../../../common/enums/justification-status.enum';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { JustificationReviewDecision } from '../dto/review-justification.dto';
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
    find: jest.fn(async () => []),
  };

  const service = new JustificationsService(
    justificationRepo as never,
    evidenceRepo as never,
    attendanceRepo as never,
    guardianLinksRepo as never,
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
    email: 't@test.com',
    roles: [],
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

  it('review APPROVED sets attendance.justification_status JUSTIFIED', async () => {
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
        status: AttendanceStatus.ABSENT,
      }),
    );
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

  it('AttendanceStatus enum still has no JUSTIFIED mark', () => {
    expect(Object.values(AttendanceStatus)).not.toContain('JUSTIFIED');
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
});
