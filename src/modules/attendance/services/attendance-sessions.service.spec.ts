import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AcademicOfferingKind } from '../../../common/enums/academic-offering-kind.enum';
import { AttendanceSessionStatus } from '../../../common/enums/attendance-session-status.enum';
import { Role } from '../../../common/enums/role.enum';
import { AcademicOfferingEligibilityPolicy } from '../../administrative/academic-offerings/policies/academic-offering-eligibility.policy';
import { AttendanceSessionsService } from './attendance-sessions.service';

describe('AttendanceSessionsService Phase 1A / 1A.1', () => {
  const sessions = {
    create: jest.fn((data) => ({ ...data })),
    save: jest.fn(async (row) => ({ ...row, id: row.id ?? 50 })),
    findOne: jest.fn(),
  };
  const teachingAssignments = {
    findOne: jest.fn(),
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
  const admin = {
    id: 1,
    email: 'a@test.com',
    roles: [Role.ADMIN],
    permissions: [],
    mustChangePassword: false,
  };

  const impartableTa = {
    id: 100,
    userId: 10,
    groupId: 20,
    offeringKind: AcademicOfferingKind.SUBJECT,
    subjectId: 3,
    specialtyId: null,
    subject: { name: 'Matemáticas' },
    specialty: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AttendanceSessionsService(
      sessions as never,
      teachingAssignments as never,
      { findOne: jest.fn(), find: jest.fn(), createQueryBuilder: jest.fn() } as never,
      eligibility as never,
      dataSource as never,
    );
    sessions.findOne.mockResolvedValue({
      id: 50,
      status: AttendanceSessionStatus.OPEN,
      teachingAssignment: impartableTa,
      teachingAssignmentId: 100,
      sessionDate: '2026-09-11',
    });
    sessionRepoTx.save.mockImplementation(async (row) => ({
      ...row,
      id: row.id ?? 50,
    }));
    auditRepoTx.save.mockImplementation(async (row) => row);
  });

  it('1. TA propia e impartible → crea OPEN', async () => {
    teachingAssignments.findOne.mockResolvedValue(impartableTa);
    eligibility.assertOfferingAllowedForGroup.mockResolvedValue(8);

    const result = await service.createSession(
      { groupId: 20, teachingAssignmentId: 100 },
      teacher,
    );

    expect(result.status).toBe(AttendanceSessionStatus.OPEN);
    expect(dataSource.transaction).toHaveBeenCalled();
    expect(auditRepoTx.save).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ATTENDANCE_SESSION_CREATED' }),
    );
  });

  it('6. sessionDate uses America/Costa_Rica helper (not UTC slice alone)', async () => {
    teachingAssignments.findOne.mockResolvedValue(impartableTa);
    eligibility.assertOfferingAllowedForGroup.mockResolvedValue(8);
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-12T02:30:00.000Z'));

    await service.createSession(
      { groupId: 20, teachingAssignmentId: 100 },
      teacher,
    );

    expect(sessionRepoTx.create).toHaveBeenCalledWith(
      expect.objectContaining({ sessionDate: '2026-03-11' }),
    );
    jest.useRealTimers();
  });

  it('8. create save + audit same transaction manager', async () => {
    teachingAssignments.findOne.mockResolvedValue(impartableTa);
    eligibility.assertOfferingAllowedForGroup.mockResolvedValue(8);
    await service.createSession(
      { groupId: 20, teachingAssignmentId: 100 },
      teacher,
    );
    expect(sessionRepoTx.save).toHaveBeenCalled();
    expect(auditRepoTx.save).toHaveBeenCalled();
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
  });

  it('9. create: audit fails → session rollback (transaction rejects)', async () => {
    teachingAssignments.findOne.mockResolvedValue(impartableTa);
    eligibility.assertOfferingAllowedForGroup.mockResolvedValue(8);
    auditRepoTx.save.mockRejectedValue(new Error('audit failed'));

    await expect(
      service.createSession(
        { groupId: 20, teachingAssignmentId: 100 },
        teacher,
      ),
    ).rejects.toThrow('audit failed');
  });

  it('2. TA ajena → 403', async () => {
    teachingAssignments.findOne.mockResolvedValue({
      ...impartableTa,
      userId: 99,
    });

    await expect(
      service.createSession(
        { groupId: 20, teachingAssignmentId: 100 },
        teacher,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('3. TA de otro grupo → reject', async () => {
    teachingAssignments.findOne.mockResolvedValue(impartableTa);

    await expect(
      service.createSession(
        { groupId: 999, teachingAssignmentId: 100 },
        teacher,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('4. guide-only → reject', async () => {
    teachingAssignments.findOne.mockResolvedValue({
      ...impartableTa,
      offeringKind: null,
      subjectId: null,
      specialtyId: null,
    });

    await expect(
      service.createSession(
        { groupId: 20, teachingAssignmentId: 100 },
        teacher,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ATTENDANCE_SESSION_GUIDE_ONLY' }),
    });
  });

  it('5. specialty en grade 8 → reject', async () => {
    teachingAssignments.findOne.mockResolvedValue({
      ...impartableTa,
      offeringKind: AcademicOfferingKind.TECHNICAL_SPECIALTY,
      subjectId: null,
      specialtyId: 7,
    });
    eligibility.assertOfferingAllowedForGroup.mockRejectedValue(
      new BadRequestException({ code: 'OFFERING_KIND_NOT_ELIGIBLE_FOR_GRADE' }),
    );

    await expect(
      service.createSession(
        { groupId: 20, teachingAssignmentId: 100 },
        teacher,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('6b. workshop en grade 11 → reject', async () => {
    teachingAssignments.findOne.mockResolvedValue({
      ...impartableTa,
      offeringKind: AcademicOfferingKind.EXPLORATORY_WORKSHOP,
      subjectId: null,
      specialtyId: 8,
    });
    eligibility.assertOfferingAllowedForGroup.mockRejectedValue(
      new BadRequestException({ code: 'OFFERING_KIND_NOT_ELIGIBLE_FOR_GRADE' }),
    );

    await expect(
      service.createSession(
        { groupId: 20, teachingAssignmentId: 100 },
        teacher,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('10-11-13. close takes pessimistic_write, OPEN→CLOSED, audit same manager', async () => {
    sessionRepoTx.findOne.mockResolvedValue({
      id: 50,
      status: AttendanceSessionStatus.OPEN,
      closedAt: null,
      teachingAssignment: impartableTa,
    });
    sessions.findOne.mockResolvedValue({
      id: 50,
      status: AttendanceSessionStatus.CLOSED,
      closedAt: new Date(),
      teachingAssignment: impartableTa,
    });

    const closed = await service.closeSession(50, teacher);
    expect(closed.status).toBe(AttendanceSessionStatus.CLOSED);
    expect(sessionRepoTx.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        lock: { mode: 'pessimistic_write' },
      }),
    );
    expect(auditRepoTx.save).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ATTENDANCE_SESSION_CLOSED' }),
    );
  });

  it('12. close CLOSED → reject', async () => {
    sessionRepoTx.findOne.mockResolvedValue({
      id: 50,
      status: AttendanceSessionStatus.CLOSED,
      teachingAssignment: impartableTa,
    });

    await expect(service.closeSession(50, teacher)).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'ATTENDANCE_SESSION_ALREADY_CLOSED',
      }),
    });
  });

  it('14. close: audit fails → close rollback', async () => {
    sessionRepoTx.findOne.mockResolvedValue({
      id: 50,
      status: AttendanceSessionStatus.OPEN,
      closedAt: null,
      teachingAssignment: impartableTa,
    });
    auditRepoTx.save.mockRejectedValue(new Error('audit close failed'));

    await expect(service.closeSession(50, teacher)).rejects.toThrow(
      'audit close failed',
    );
  });

  it('15. PUT records and close both lock AttendanceSession row (structural)', async () => {
    // close uses pessimistic_write; records service uses the same mode (asserted there).
    sessionRepoTx.findOne.mockResolvedValue({
      id: 50,
      status: AttendanceSessionStatus.OPEN,
      closedAt: null,
      teachingAssignment: impartableTa,
    });
    await service.closeSession(50, teacher);
    expect(sessionRepoTx.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
  });

  describe('available offerings', () => {
    function mockQb(rows: unknown[]) {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(rows),
      };
      teachingAssignments.createQueryBuilder.mockReturnValue(qb);
      return qb;
    }

    it('9-10. grupo 8 → SUBJECT + WORKSHOP; no SPECIALTY', async () => {
      eligibility.getGradeLevelForGroup.mockResolvedValue(8);
      eligibility.allowedKindsForGroup.mockResolvedValue([
        AcademicOfferingKind.SUBJECT,
        AcademicOfferingKind.EXPLORATORY_WORKSHOP,
      ]);
      mockQb([
        {
          id: 1,
          userId: 10,
          offeringKind: AcademicOfferingKind.SUBJECT,
          subjectId: 3,
          specialtyId: null,
          subject: { name: 'Mate' },
        },
        {
          id: 2,
          userId: 10,
          offeringKind: AcademicOfferingKind.EXPLORATORY_WORKSHOP,
          subjectId: null,
          specialtyId: 4,
          specialty: { name: 'Robótica' },
        },
        {
          id: 3,
          userId: 10,
          offeringKind: AcademicOfferingKind.TECHNICAL_SPECIALTY,
          subjectId: null,
          specialtyId: 5,
          specialty: { name: 'Info' },
        },
      ]);

      const views = await service.listAvailableOfferings(20, teacher);
      expect(views.map((v) => v.offeringKind).sort()).toEqual([
        AcademicOfferingKind.EXPLORATORY_WORKSHOP,
        AcademicOfferingKind.SUBJECT,
      ]);
    });

    it('11-12. grupo 11 → SUBJECT + SPECIALTY; no WORKSHOP', async () => {
      eligibility.getGradeLevelForGroup.mockResolvedValue(11);
      eligibility.allowedKindsForGroup.mockResolvedValue([
        AcademicOfferingKind.SUBJECT,
        AcademicOfferingKind.TECHNICAL_SPECIALTY,
      ]);
      mockQb([
        {
          id: 1,
          offeringKind: AcademicOfferingKind.SUBJECT,
          subjectId: 3,
          specialtyId: null,
          subject: { name: 'Física' },
        },
        {
          id: 2,
          offeringKind: AcademicOfferingKind.TECHNICAL_SPECIALTY,
          subjectId: null,
          specialtyId: 5,
          specialty: { name: 'Info' },
        },
        {
          id: 3,
          offeringKind: AcademicOfferingKind.EXPLORATORY_WORKSHOP,
          subjectId: null,
          specialtyId: 4,
          specialty: { name: 'Robótica' },
        },
      ]);

      const views = await service.listAvailableOfferings(20, teacher);
      expect(views.map((v) => v.offeringKind).sort()).toEqual([
        AcademicOfferingKind.SUBJECT,
        AcademicOfferingKind.TECHNICAL_SPECIALTY,
      ]);
    });

    it('13. no incluir TA guide-only', async () => {
      eligibility.getGradeLevelForGroup.mockResolvedValue(8);
      eligibility.allowedKindsForGroup.mockResolvedValue([
        AcademicOfferingKind.SUBJECT,
        AcademicOfferingKind.EXPLORATORY_WORKSHOP,
      ]);
      mockQb([
        {
          id: 9,
          offeringKind: null,
          subjectId: null,
          specialtyId: null,
        },
      ]);

      await expect(service.listAvailableOfferings(20, teacher)).resolves.toEqual(
        [],
      );
    });

    it('14. no incluir TAs de otro docente (filtro query)', async () => {
      eligibility.getGradeLevelForGroup.mockResolvedValue(8);
      eligibility.allowedKindsForGroup.mockResolvedValue([
        AcademicOfferingKind.SUBJECT,
      ]);
      const qb = mockQb([]);
      await service.listAvailableOfferings(20, teacher);
      expect(qb.andWhere).toHaveBeenCalledWith('ta.id_users = :teacherId', {
        teacherId: 10,
      });
    });

    it('admin puede listar sin filtro de docente', async () => {
      eligibility.getGradeLevelForGroup.mockResolvedValue(8);
      eligibility.allowedKindsForGroup.mockResolvedValue([
        AcademicOfferingKind.SUBJECT,
      ]);
      const qb = mockQb([]);
      await service.listAvailableOfferings(20, admin);
      expect(qb.andWhere).not.toHaveBeenCalledWith(
        'ta.id_users = :teacherId',
        expect.anything(),
      );
    });
  });

  it('TA inexistente → 404', async () => {
    teachingAssignments.findOne.mockResolvedValue(null);
    await expect(
      service.createSession(
        { groupId: 20, teachingAssignmentId: 100 },
        teacher,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('Phase 1A.2 listAttendanceGroups', () => {
    function mockGroupsQb(rows: unknown[]) {
      const qb = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(rows),
      };
      teachingAssignments.createQueryBuilder.mockReturnValue(qb);
      return qb;
    }

    function taRow(partial: {
      id: number;
      userId: number;
      groupId: number;
      groupName: string;
      gradeLevel: number;
      sectionId: number;
      offeringKind: AcademicOfferingKind | null;
      subjectId?: number | null;
      specialtyId?: number | null;
    }) {
      return {
        id: partial.id,
        userId: partial.userId,
        groupId: partial.groupId,
        offeringKind: partial.offeringKind,
        subjectId: partial.subjectId ?? null,
        specialtyId: partial.specialtyId ?? null,
        group: {
          id: partial.groupId,
          name: partial.groupName,
          sectionId: partial.sectionId,
          section: {
            id: partial.sectionId,
            gradeLevel: partial.gradeLevel,
          },
        },
      };
    }

    it('1. Docente con 2 TAs impartibles en mismo grupo → aparece una vez', async () => {
      mockGroupsQb([
        taRow({
          id: 1,
          userId: 10,
          groupId: 20,
          groupName: '8-1',
          gradeLevel: 8,
          sectionId: 5,
          offeringKind: AcademicOfferingKind.SUBJECT,
          subjectId: 1,
        }),
        taRow({
          id: 2,
          userId: 10,
          groupId: 20,
          groupName: '8-1',
          gradeLevel: 8,
          sectionId: 5,
          offeringKind: AcademicOfferingKind.EXPLORATORY_WORKSHOP,
          specialtyId: 9,
        }),
      ]);

      const views = await service.listAttendanceGroups(teacher);
      expect(views).toEqual([
        { groupId: 20, name: '8-1', gradeLevel: 8, sectionId: 5 },
      ]);
    });

    it('2. Docente con TAs en 2 grupos → aparecen ambos', async () => {
      mockGroupsQb([
        taRow({
          id: 1,
          userId: 10,
          groupId: 20,
          groupName: 'B-grupo',
          gradeLevel: 8,
          sectionId: 5,
          offeringKind: AcademicOfferingKind.SUBJECT,
          subjectId: 1,
        }),
        taRow({
          id: 2,
          userId: 10,
          groupId: 21,
          groupName: 'A-grupo',
          gradeLevel: 8,
          sectionId: 5,
          offeringKind: AcademicOfferingKind.SUBJECT,
          subjectId: 2,
        }),
      ]);

      const views = await service.listAttendanceGroups(teacher);
      expect(views.map((v) => v.groupId).sort()).toEqual([20, 21]);
      // same grade → name asc
      expect(views.map((v) => v.name)).toEqual(['A-grupo', 'B-grupo']);
    });

    it('3. TA ajena → grupo no aparece (filtro query)', async () => {
      const qb = mockGroupsQb([]);
      await service.listAttendanceGroups(teacher);
      expect(qb.andWhere).toHaveBeenCalledWith('ta.id_users = :teacherId', {
        teacherId: 10,
      });
    });

    it('4. guide-only → grupo no aparece', async () => {
      mockGroupsQb([
        taRow({
          id: 1,
          userId: 10,
          groupId: 20,
          groupName: '8-1',
          gradeLevel: 8,
          sectionId: 5,
          offeringKind: null,
        }),
      ]);
      await expect(service.listAttendanceGroups(teacher)).resolves.toEqual([]);
    });

    it('5. grupo 8 con SUBJECT válida → aparece', async () => {
      mockGroupsQb([
        taRow({
          id: 1,
          userId: 10,
          groupId: 20,
          groupName: '8-1',
          gradeLevel: 8,
          sectionId: 5,
          offeringKind: AcademicOfferingKind.SUBJECT,
          subjectId: 1,
        }),
      ]);
      const views = await service.listAttendanceGroups(teacher);
      expect(views).toHaveLength(1);
      expect(views[0].gradeLevel).toBe(8);
    });

    it('6. grupo 8 con SPECIALTY inválida → no aparece', async () => {
      mockGroupsQb([
        taRow({
          id: 1,
          userId: 10,
          groupId: 20,
          groupName: '8-1',
          gradeLevel: 8,
          sectionId: 5,
          offeringKind: AcademicOfferingKind.TECHNICAL_SPECIALTY,
          specialtyId: 7,
        }),
      ]);
      await expect(service.listAttendanceGroups(teacher)).resolves.toEqual([]);
    });

    it('7. grupo 11 con SPECIALTY válida → aparece', async () => {
      mockGroupsQb([
        taRow({
          id: 1,
          userId: 10,
          groupId: 30,
          groupName: '11-1',
          gradeLevel: 11,
          sectionId: 8,
          offeringKind: AcademicOfferingKind.TECHNICAL_SPECIALTY,
          specialtyId: 7,
        }),
      ]);
      const views = await service.listAttendanceGroups(teacher);
      expect(views).toEqual([
        { groupId: 30, name: '11-1', gradeLevel: 11, sectionId: 8 },
      ]);
    });

    it('8. Admin ve grupos con TAs impartibles de otros docentes', async () => {
      const qb = mockGroupsQb([
        taRow({
          id: 1,
          userId: 99,
          groupId: 40,
          groupName: '10-1',
          gradeLevel: 10,
          sectionId: 9,
          offeringKind: AcademicOfferingKind.SUBJECT,
          subjectId: 1,
        }),
      ]);
      const views = await service.listAttendanceGroups(admin);
      expect(qb.andWhere).not.toHaveBeenCalledWith(
        'ta.id_users = :teacherId',
        expect.anything(),
      );
      expect(views).toEqual([
        { groupId: 40, name: '10-1', gradeLevel: 10, sectionId: 9 },
      ]);
    });

    it('9. grupo solo guide-only → Admin tampoco lo recibe', async () => {
      mockGroupsQb([
        taRow({
          id: 1,
          userId: 99,
          groupId: 40,
          groupName: '10-1',
          gradeLevel: 10,
          sectionId: 9,
          offeringKind: null,
        }),
      ]);
      await expect(service.listAttendanceGroups(admin)).resolves.toEqual([]);
    });
  });

  describe('Phase 1A.2 getSessionDetail', () => {
    function sessionWithTa(
      ta: Record<string, unknown>,
      status: AttendanceSessionStatus = AttendanceSessionStatus.OPEN,
    ) {
      return {
        id: 50,
        status,
        sessionDate: '2026-09-11',
        startedAt: new Date('2026-09-11T14:00:00Z'),
        closedAt:
          status === AttendanceSessionStatus.CLOSED
            ? new Date('2026-09-11T15:00:00Z')
            : null,
        teachingAssignmentId: ta.id,
        teachingAssignment: ta,
      };
    }

    it('10. dueño consulta sesión OPEN', async () => {
      sessions.findOne.mockResolvedValue(
        sessionWithTa({
          ...impartableTa,
          group: {
            id: 20,
            name: '8-1',
            section: { gradeLevel: 8 },
          },
        }),
      );
      const detail = await service.getSessionDetail(50, teacher);
      expect(detail.status).toBe(AttendanceSessionStatus.OPEN);
      expect(detail.sessionId).toBe(50);
    });

    it('11. dueño consulta sesión CLOSED', async () => {
      sessions.findOne.mockResolvedValue(
        sessionWithTa(
          {
            ...impartableTa,
            group: {
              id: 20,
              name: '8-1',
              section: { gradeLevel: 8 },
            },
          },
          AttendanceSessionStatus.CLOSED,
        ),
      );
      const detail = await service.getSessionDetail(50, teacher);
      expect(detail.status).toBe(AttendanceSessionStatus.CLOSED);
      expect(detail.closedAt).toBeTruthy();
    });

    it('12. docente ajeno → 403', async () => {
      sessions.findOne.mockResolvedValue(
        sessionWithTa({
          ...impartableTa,
          userId: 99,
          group: { id: 20, name: '8-1', section: { gradeLevel: 8 } },
        }),
      );
      await expect(service.getSessionDetail(50, teacher)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('13. sesión inexistente → 404', async () => {
      sessions.findOne.mockResolvedValue(null);
      await expect(service.getSessionDetail(999, teacher)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('14. Admin puede consultar', async () => {
      sessions.findOne.mockResolvedValue(
        sessionWithTa({
          ...impartableTa,
          userId: 99,
          group: { id: 20, name: '8-1', section: { gradeLevel: 8 } },
        }),
      );
      await expect(service.getSessionDetail(50, admin)).resolves.toMatchObject({
        sessionId: 50,
        teachingAssignmentId: 100,
      });
    });

    it('15. SUBJECT resuelve kind/id/name/labelKind', async () => {
      sessions.findOne.mockResolvedValue(
        sessionWithTa({
          ...impartableTa,
          offeringKind: AcademicOfferingKind.SUBJECT,
          subjectId: 3,
          subject: { name: 'Matemáticas' },
          specialtyId: null,
          specialty: null,
          group: { id: 20, name: '8-1', section: { gradeLevel: 8 } },
        }),
      );
      const detail = await service.getSessionDetail(50, teacher);
      expect(detail.offering).toEqual({
        kind: AcademicOfferingKind.SUBJECT,
        id: 3,
        name: 'Matemáticas',
        labelKind: 'Asignatura',
      });
    });

    it('16. WORKSHOP resuelve correctamente', async () => {
      sessions.findOne.mockResolvedValue(
        sessionWithTa({
          ...impartableTa,
          offeringKind: AcademicOfferingKind.EXPLORATORY_WORKSHOP,
          subjectId: null,
          subject: null,
          specialtyId: 6,
          specialty: { name: 'Cocina' },
          group: { id: 20, name: '8-1', section: { gradeLevel: 8 } },
        }),
      );
      const detail = await service.getSessionDetail(50, teacher);
      expect(detail.offering).toEqual({
        kind: AcademicOfferingKind.EXPLORATORY_WORKSHOP,
        id: 6,
        name: 'Cocina',
        labelKind: 'Taller exploratorio',
      });
    });

    it('17. SPECIALTY resuelve correctamente', async () => {
      sessions.findOne.mockResolvedValue(
        sessionWithTa({
          ...impartableTa,
          offeringKind: AcademicOfferingKind.TECHNICAL_SPECIALTY,
          subjectId: null,
          subject: null,
          specialtyId: 2,
          specialty: { name: 'Informática' },
          group: { id: 30, name: '11-1', section: { gradeLevel: 11 } },
        }),
      );
      const detail = await service.getSessionDetail(50, teacher);
      expect(detail.offering).toEqual({
        kind: AcademicOfferingKind.TECHNICAL_SPECIALTY,
        id: 2,
        name: 'Informática',
        labelKind: 'Especialidad técnica',
      });
    });

    it('18. group id/name/gradeLevel', async () => {
      sessions.findOne.mockResolvedValue(
        sessionWithTa({
          ...impartableTa,
          group: { id: 20, name: '8-1', section: { gradeLevel: 8 } },
        }),
      );
      const detail = await service.getSessionDetail(50, teacher);
      expect(detail.group).toEqual({ id: 20, name: '8-1', gradeLevel: 8 });
    });
  });
});
