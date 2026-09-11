import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AcademicOfferingKind } from '../../../common/enums/academic-offering-kind.enum';
import { ScheduleSlotType } from '../../../common/enums/schedule-slot-type.enum';
import { ScheduleEntriesService } from './schedule-entries.service';

describe('ScheduleEntriesService (QueryRunner lifecycle)', () => {
  const callOrder: string[] = [];

  const entryRepo = {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((data) => ({ ...data })),
    save: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const taRepo = { findOne: jest.fn() };
  const slotRepo = { findOne: jest.fn() };
  const attendanceSessionRepo = {
    find: jest.fn().mockResolvedValue([]),
  };

  let isTransactionActive = false;
  let getLockResults: Array<number | null> = [1, 1];
  let getLockIdx = 0;

  const manager = {
    getRepository: jest.fn((entity: { name?: string }) => {
      const n = typeof entity === 'function' ? entity.name : String(entity);
      if (n === 'ScheduleEntry') return entryRepo;
      if (n === 'TeachingAssignment') return taRepo;
      if (n === 'ScheduleTimeSlot') return slotRepo;
      if (n === 'AttendanceSession') return attendanceSessionRepo;
      return entryRepo;
    }),
  };

  const queryRunner = {
    connect: jest.fn(async () => {
      callOrder.push('connect');
    }),
    startTransaction: jest.fn(async () => {
      isTransactionActive = true;
      callOrder.push('startTransaction');
    }),
    commitTransaction: jest.fn(async () => {
      isTransactionActive = false;
      callOrder.push('COMMIT');
    }),
    rollbackTransaction: jest.fn(async () => {
      isTransactionActive = false;
      callOrder.push('ROLLBACK');
    }),
    release: jest.fn(async () => {
      callOrder.push('release');
    }),
    get isTransactionActive() {
      return isTransactionActive;
    },
    query: jest.fn(async (sql: string) => {
      if (sql.includes('GET_LOCK')) {
        callOrder.push('GET_LOCK');
        const value = getLockResults[getLockIdx++] ?? 1;
        return [{ acquired: value }];
      }
      if (sql.includes('RELEASE_LOCK')) {
        callOrder.push('RELEASE_LOCK');
        return [{ released: 1 }];
      }
      return [];
    }),
    manager,
  };

  const dataSource = {
    createQueryRunner: jest.fn(() => queryRunner),
  };

  const timeSlots = {
    requireAssignableSlot: jest.fn(),
  };

  const eligibility = {
    resolveOffering: jest.fn(),
    assertOfferingAllowedForGroup: jest.fn(),
  };

  const listQb = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  let service: ScheduleEntriesService;

  const classSlot = {
    id: 1,
    name: 'Lección 1',
    startTime: '07:00:00',
    endTime: '07:40:00',
    displayOrder: 1,
    slotType: ScheduleSlotType.CLASS,
    isActive: true,
  };

  function impartableTa(overrides: Record<string, unknown> = {}) {
    return {
      id: 10,
      userId: 5,
      groupId: 3,
      academicPeriodId: 1,
      offeringKind: AcademicOfferingKind.SUBJECT,
      subjectId: 2,
      specialtyId: null,
      isGuideTeacher: false,
      user: { name: 'Ana', first_lastname: 'Pérez', second_lastname: null },
      group: { id: 3, name: '7-1', section: { gradeLevel: 7 } },
      subject: { id: 2, name: 'Matemáticas' },
      specialty: null,
      academicPeriod: { id: 1, name: '2026' },
      ...overrides,
    };
  }

  function conflictQb(rows: unknown[]) {
    return {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(rows),
    };
  }

  async function expectConflictCode(promise: Promise<unknown>, code: string) {
    try {
      await promise;
      throw new Error('expected rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({ code });
    }
  }

  beforeEach(() => {
    jest.clearAllMocks();
    entryRepo.findOne.mockReset();
    entryRepo.find.mockReset();
    entryRepo.find.mockResolvedValue([]);
    entryRepo.save.mockReset();
    entryRepo.createQueryBuilder.mockReset();
    taRepo.findOne.mockReset();
    slotRepo.findOne.mockReset();
    attendanceSessionRepo.find.mockReset();
    attendanceSessionRepo.find.mockResolvedValue([]);
    callOrder.length = 0;
    isTransactionActive = false;
    getLockResults = [1, 1];
    getLockIdx = 0;

    service = new ScheduleEntriesService(
      entryRepo as never,
      taRepo as never,
      attendanceSessionRepo as never,
      timeSlots as never,
      eligibility as never,
      {
        findGroupAsOf: jest.fn(),
        findLatestForPeriod: jest.fn(),
      } as never,
      dataSource as never,
    );

    entryRepo.createQueryBuilder.mockReturnValue(listQb);
    listQb.getMany.mockResolvedValue([]);
    entryRepo.create.mockImplementation((data) => ({ ...data }));
    timeSlots.requireAssignableSlot.mockImplementation(
      async (id: number, mgr?: { getRepository: typeof manager.getRepository }) => {
        callOrder.push('requireAssignableSlot');
        expect(mgr).toBe(manager);
        return { ...classSlot, id };
      },
    );
    eligibility.resolveOffering.mockResolvedValue({
      kind: AcademicOfferingKind.SUBJECT,
      subjectId: 2,
      specialtyId: null,
      name: 'Matemáticas',
    });
    eligibility.assertOfferingAllowedForGroup.mockResolvedValue(7);
    slotRepo.findOne.mockResolvedValue(classSlot);
    entryRepo.save.mockImplementation(async (row) => {
      callOrder.push('INSERT');
      return { id: 100, ...row };
    });
  });

  function stubHappyCreate(ta = impartableTa()) {
    taRepo.findOne.mockResolvedValue(ta);
    entryRepo.createQueryBuilder.mockReturnValue(conflictQb([]));
    entryRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 100,
        dayOfWeek: 1,
        timeSlotId: 1,
        teachingAssignmentId: ta.id,
        timeSlot: classSlot,
        teachingAssignment: ta,
      });
  }

  it('4. success create: GET_LOCK → INSERT → COMMIT → RELEASE_LOCK', async () => {
    stubHappyCreate();
    await service.create({
      teachingAssignmentId: 10,
      dayOfWeek: 1,
      timeSlotId: 1,
    });

    const getIdx = callOrder.indexOf('GET_LOCK');
    const insertIdx = callOrder.indexOf('INSERT');
    const commitIdx = callOrder.indexOf('COMMIT');
    const releaseIdx = callOrder.indexOf('RELEASE_LOCK');
    expect(getIdx).toBeGreaterThanOrEqual(0);
    expect(insertIdx).toBeGreaterThan(getIdx);
    expect(commitIdx).toBeGreaterThan(insertIdx);
    expect(releaseIdx).toBeGreaterThan(commitIdx);
    expect(callOrder).toContain('release');
    expect(callOrder.indexOf('RELEASE_LOCK')).toBeLessThan(
      callOrder.lastIndexOf('release'),
    );
  });

  it('5. success update: COMMIT antes de RELEASE_LOCK', async () => {
    const ta = impartableTa();
    entryRepo.findOne
      .mockResolvedValueOnce({
        id: 100,
        teachingAssignmentId: 10,
        dayOfWeek: 1,
        timeSlotId: 1,
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 100,
        teachingAssignmentId: 10,
        dayOfWeek: 1,
        timeSlotId: 1,
        timeSlot: classSlot,
      })
      .mockResolvedValueOnce({
        id: 100,
        dayOfWeek: 2,
        timeSlotId: 1,
        teachingAssignmentId: 10,
        timeSlot: classSlot,
        teachingAssignment: ta,
      });
    taRepo.findOne.mockResolvedValue(ta);
    entryRepo.createQueryBuilder.mockReturnValue(conflictQb([]));
    entryRepo.save.mockImplementation(async (row) => {
      callOrder.push('UPDATE');
      return row;
    });

    await service.update(100, { dayOfWeek: 2 });
    expect(callOrder.indexOf('COMMIT')).toBeLessThan(
      callOrder.indexOf('RELEASE_LOCK'),
    );
    expect(callOrder.indexOf('UPDATE')).toBeLessThan(callOrder.indexOf('COMMIT'));
  });

  it('6. fallo después de GET_LOCK: ROLLBACK → RELEASE_LOCK', async () => {
    taRepo.findOne.mockResolvedValue(impartableTa());
    entryRepo.createQueryBuilder.mockReturnValue(
      conflictQb([
        {
          id: 70,
          teachingAssignmentId: 11,
          teachingAssignment: impartableTa({ id: 11, groupId: 8 }),
        },
      ]),
    );

    await expectConflictCode(
      service.create({
        teachingAssignmentId: 10,
        dayOfWeek: 1,
        timeSlotId: 1,
      }),
      'SCHEDULE_TEACHER_CONFLICT',
    );

    expect(callOrder).toContain('GET_LOCK');
    expect(callOrder).toContain('ROLLBACK');
    expect(callOrder).toContain('RELEASE_LOCK');
    expect(callOrder).toContain('release');
    expect(callOrder).not.toContain('COMMIT');
    expect(callOrder.indexOf('ROLLBACK')).toBeLessThan(
      callOrder.indexOf('RELEASE_LOCK'),
    );
  });

  it('7. fallo INSERT: rollback → release locks', async () => {
    stubHappyCreate();
    entryRepo.save.mockImplementation(async () => {
      callOrder.push('INSERT');
      throw Object.assign(new Error('db'), { code: 'ER_DUP_ENTRY' });
    });

    await expect(
      service.create({
        teachingAssignmentId: 10,
        dayOfWeek: 1,
        timeSlotId: 1,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(callOrder).toContain('ROLLBACK');
    expect(callOrder).toContain('RELEASE_LOCK');
    expect(callOrder).toContain('release');
    expect(callOrder).not.toContain('COMMIT');
  });

  it('11. queryRunner.release siempre ocurre', async () => {
    taRepo.findOne.mockResolvedValue(null);
    await expect(
      service.create({
        teachingAssignmentId: 999,
        dayOfWeek: 1,
        timeSlotId: 1,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(queryRunner.release).toHaveBeenCalled();
  });

  it('12. TimeSlot lookup usa manager transaccional', async () => {
    stubHappyCreate();
    await service.create({
      teachingAssignmentId: 10,
      dayOfWeek: 1,
      timeSlotId: 1,
    });
    expect(timeSlots.requireAssignableSlot).toHaveBeenCalledWith(1, manager);
  });

  it('8. crear entry válido', async () => {
    stubHappyCreate();
    const view = await service.create({
      teachingAssignmentId: 10,
      dayOfWeek: 1,
      timeSlotId: 1,
    });
    expect(view.entryId).toBe(100);
    expect(view.teachingAssignment.offering.name).toBe('Matemáticas');
  });

  it('9. guide-only rechazado', async () => {
    taRepo.findOne.mockResolvedValue(
      impartableTa({
        offeringKind: null,
        subjectId: null,
        specialtyId: null,
      }),
    );
    await expect(
      service.create({
        teachingAssignmentId: 10,
        dayOfWeek: 1,
        timeSlotId: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('10. offering inválida para grade rechazada', async () => {
    taRepo.findOne.mockResolvedValue(impartableTa());
    eligibility.assertOfferingAllowedForGroup.mockRejectedValue(
      new BadRequestException({ code: 'OFFERING_KIND_NOT_ELIGIBLE_FOR_GRADE' }),
    );
    await expect(
      service.create({
        teachingAssignmentId: 10,
        dayOfWeek: 1,
        timeSlotId: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('13. teacher conflict', async () => {
    taRepo.findOne.mockResolvedValue(impartableTa({ id: 10, groupId: 3 }));
    entryRepo.createQueryBuilder.mockReturnValue(
      conflictQb([
        {
          id: 70,
          teachingAssignmentId: 11,
          teachingAssignment: impartableTa({ id: 11, groupId: 8 }),
        },
      ]),
    );
    await expectConflictCode(
      service.create({
        teachingAssignmentId: 10,
        dayOfWeek: 1,
        timeSlotId: 1,
      }),
      'SCHEDULE_TEACHER_CONFLICT',
    );
  });

  it('14. group conflict', async () => {
    taRepo.findOne.mockResolvedValue(impartableTa({ id: 10, userId: 5 }));
    entryRepo.createQueryBuilder.mockReturnValue(
      conflictQb([
        {
          id: 71,
          teachingAssignmentId: 12,
          teachingAssignment: impartableTa({ id: 12, userId: 9 }),
        },
      ]),
    );
    await expectConflictCode(
      service.create({
        teachingAssignmentId: 10,
        dayOfWeek: 1,
        timeSlotId: 1,
      }),
      'SCHEDULE_GROUP_CONFLICT',
    );
  });

  it('15. misma materia + teacher/group distintos permitido', async () => {
    stubHappyCreate(impartableTa({ id: 10, userId: 5, groupId: 3 }));
    await expect(
      service.create({
        teachingAssignmentId: 10,
        dayOfWeek: 1,
        timeSlotId: 1,
      }),
    ).resolves.toMatchObject({ entryId: 100 });
  });

  it('16. duplicate exacto', async () => {
    const ta = impartableTa();
    taRepo.findOne.mockResolvedValue(ta);
    entryRepo.createQueryBuilder.mockReturnValue(conflictQb([]));
    entryRepo.findOne.mockResolvedValue({
      id: 55,
      teachingAssignmentId: ta.id,
      dayOfWeek: 1,
      timeSlotId: 1,
    });
    await expectConflictCode(
      service.create({
        teachingAssignmentId: ta.id,
        dayOfWeek: 1,
        timeSlotId: 1,
      }),
      'SCHEDULE_ENTRY_DUPLICATE',
    );
  });

  it('17. update excluye entry propia', async () => {
    const ta = impartableTa();
    entryRepo.findOne
      .mockResolvedValueOnce({
        id: 100,
        teachingAssignmentId: 10,
        dayOfWeek: 1,
        timeSlotId: 1,
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 100,
        dayOfWeek: 1,
        timeSlotId: 1,
        teachingAssignmentId: 10,
        timeSlot: classSlot,
        teachingAssignment: ta,
      });
    taRepo.findOne.mockResolvedValue(ta);
    const qb = conflictQb([]);
    entryRepo.createQueryBuilder.mockReturnValue(qb);
    entryRepo.save.mockImplementation(async (row) => row);

    await service.update(100, { dayOfWeek: 1 });
    expect(qb.andWhere).toHaveBeenCalledWith(
      'entry.id != :excludeEntryId',
      expect.objectContaining({ excludeEntryId: 100 }),
    );
  });

  it('18. create/update usan createQueryRunner (mismo esquema de locks)', async () => {
    stubHappyCreate();
    await service.create({
      teachingAssignmentId: 10,
      dayOfWeek: 1,
      timeSlotId: 1,
    });
    expect(dataSource.createQueryRunner).toHaveBeenCalled();

    callOrder.length = 0;
    getLockIdx = 0;
    const ta = impartableTa();
    entryRepo.findOne
      .mockResolvedValueOnce({
        id: 100,
        teachingAssignmentId: 10,
        dayOfWeek: 1,
        timeSlotId: 1,
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 100,
        teachingAssignmentId: 10,
        dayOfWeek: 1,
        timeSlotId: 1,
        timeSlot: classSlot,
      })
      .mockResolvedValueOnce({
        id: 100,
        dayOfWeek: 2,
        timeSlotId: 1,
        teachingAssignmentId: 10,
        timeSlot: classSlot,
        teachingAssignment: ta,
      });
    taRepo.findOne.mockResolvedValue(ta);
    entryRepo.createQueryBuilder.mockReturnValue(conflictQb([]));
    entryRepo.save.mockImplementation(async (row) => row);
    await service.update(100, { dayOfWeek: 2 });
    expect(callOrder).toContain('GET_LOCK');
    expect(callOrder.indexOf('COMMIT')).toBeLessThan(
      callOrder.indexOf('RELEASE_LOCK'),
    );
  });

  it('GET_LOCK timeout en create', async () => {
    taRepo.findOne.mockResolvedValue(impartableTa());
    slotRepo.findOne.mockResolvedValue(classSlot);
    getLockResults = [0];
    await expect(
      service.create({
        teachingAssignmentId: 10,
        dayOfWeek: 1,
        timeSlotId: 1,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(callOrder).toContain('ROLLBACK');
    expect(callOrder).toContain('release');
  });

  it('20. delete entry', async () => {
    entryRepo.findOne.mockResolvedValue({
      id: 100,
      teachingAssignmentId: 10,
      dayOfWeek: 1,
      timeSlot: classSlot,
    });
    entryRepo.find.mockResolvedValue([
      {
        id: 100,
        teachingAssignmentId: 10,
        dayOfWeek: 1,
        timeSlot: classSlot,
      },
    ]);
    await expect(service.remove(100)).resolves.toEqual({ deleted: true });
  });

  it('F. delete blocked when occurrence in use', async () => {
    entryRepo.findOne.mockResolvedValue({
      id: 100,
      teachingAssignmentId: 10,
      dayOfWeek: 1,
      timeSlot: classSlot,
    });
    entryRepo.find.mockResolvedValue([
      {
        id: 100,
        teachingAssignmentId: 10,
        dayOfWeek: 1,
        timeSlot: classSlot,
      },
    ]);
    attendanceSessionRepo.find.mockResolvedValue([
      { id: 1, scheduleEntryId: 100 },
    ]);
    await expectConflictCode(service.remove(100), 'SCHEDULE_OCCURRENCE_IN_USE');
  });

  it('F. create adjacent to used run blocked', async () => {
    const ta = impartableTa();
    taRepo.findOne.mockResolvedValue(ta);
    entryRepo.createQueryBuilder.mockReturnValue(conflictQb([]));
    entryRepo.findOne.mockResolvedValue(null);
    entryRepo.find.mockResolvedValue([
      {
        id: 50,
        teachingAssignmentId: 10,
        dayOfWeek: 1,
        timeSlot: {
          id: 1,
          startTime: '07:00:00',
          endTime: '07:40:00',
          displayOrder: 1,
          slotType: ScheduleSlotType.CLASS,
        },
      },
    ]);
    attendanceSessionRepo.find.mockResolvedValue([
      { id: 1, scheduleEntryId: 50 },
    ]);
    slotRepo.findOne.mockResolvedValue({
      id: 2,
      startTime: '07:40:00',
      endTime: '08:20:00',
      displayOrder: 2,
      slotType: ScheduleSlotType.CLASS,
      isActive: true,
    });
    timeSlots.requireAssignableSlot.mockResolvedValue({
      id: 2,
      startTime: '07:40:00',
      endTime: '08:20:00',
      displayOrder: 2,
      slotType: ScheduleSlotType.CLASS,
      isActive: true,
    });

    await expectConflictCode(
      service.create({
        teachingAssignmentId: 10,
        dayOfWeek: 1,
        timeSlotId: 2,
      }),
      'SCHEDULE_OCCURRENCE_IN_USE',
    );
  });

  it('21-24. filtros list', async () => {
    entryRepo.createQueryBuilder.mockReturnValue(listQb);
    await service.list({
      teacherId: 5,
      groupId: 3,
      periodId: 1,
      dayOfWeek: 2,
    });
    expect(listQb.andWhere).toHaveBeenCalledWith(
      'ta.userId = :teacherId',
      expect.objectContaining({ teacherId: 5 }),
    );
  });
});
