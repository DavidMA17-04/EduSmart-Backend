import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ScheduleSlotType } from '../../../common/enums/schedule-slot-type.enum';
import { ScheduleTimeSlotsService } from './schedule-time-slots.service';
import { SCHEDULE_TIME_SLOTS_MUTATE_LOCK_KEY } from '../utils/schedule-time-slot-mutations.util';

describe('ScheduleTimeSlotsService (hardening)', () => {
  const callOrder: string[] = [];

  const slotStore = new Map<number, Record<string, unknown>>();
  let nextId = 1;

  const slotQbState: {
    filters: Record<string, unknown>;
    excludeId?: number;
    result: Record<string, unknown> | null;
  } = { filters: {}, result: null };

  type Qb = { where: jest.Mock; andWhere: jest.Mock; getOne: jest.Mock };

  const slotRepo = {
    find: jest.fn(),
    findOne: jest.fn(
      async (opts: { where?: { id?: number }; lock?: unknown }) => {
        if (opts?.lock) callOrder.push('pessimistic_write');
        const id = opts?.where?.id;
        if (id == null) return null;
        return slotStore.get(id) ?? null;
      },
    ),
    create: jest.fn((data: Record<string, unknown>) => ({ ...data })),
    save: jest.fn(async (row: Record<string, unknown>) => {
      const id = (row.id as number | undefined) ?? nextId++;
      const saved = { ...row, id };
      slotStore.set(id, saved);
      return saved;
    }),
    remove: jest.fn(async (row: { id: number }) => {
      slotStore.delete(row.id);
    }),
    createQueryBuilder: jest.fn(() => {
      slotQbState.filters = {};
      slotQbState.excludeId = undefined;
      const qb = {} as Qb;
      qb.where = jest.fn((sql: string, params?: Record<string, unknown>) => {
        Object.assign(slotQbState.filters, params ?? {});
        if (sql.includes('isActive')) {
          slotQbState.filters.isActive = params?.active;
        }
        return qb;
      });
      qb.andWhere = jest.fn((sql: string, params?: Record<string, unknown>) => {
        Object.assign(slotQbState.filters, params ?? {});
        if (sql.includes('id !=') || sql.includes('id <>')) {
          slotQbState.excludeId = params?.excludeId as number | undefined;
        }
        return qb;
      });
      qb.getOne = jest.fn(async () => {
        if (slotQbState.result) return slotQbState.result;
        for (const slot of slotStore.values()) {
          if (slot.isActive !== true && slot.isActive !== 1) continue;
          if (
            slotQbState.excludeId != null &&
            slot.id === slotQbState.excludeId
          ) {
            continue;
          }
          const f = slotQbState.filters;
          if (
            f.candidateStart != null &&
            f.candidateEnd != null &&
            String(slot.startTime) < String(f.candidateEnd) &&
            String(slot.endTime) > String(f.candidateStart)
          ) {
            return slot;
          }
          if (f.displayOrder != null && slot.displayOrder === f.displayOrder) {
            return slot;
          }
          if (
            f.lessonNumber != null &&
            slot.slotType === ScheduleSlotType.CLASS &&
            slot.lessonNumber === f.lessonNumber
          ) {
            return slot;
          }
        }
        return null;
      });
      return qb;
    }),
  };

  let entriesExist = false;
  const entryRepo = {
    exists: jest.fn(async () => entriesExist),
  };

  let isTransactionActive = false;
  let getLockResult: number | null = 1;
  let releaseShouldThrow = false;

  const manager = {
    getRepository: jest.fn((entity: { name?: string }) => {
      const n = typeof entity === 'function' ? entity.name : String(entity);
      if (n === 'ScheduleEntry') return entryRepo;
      return slotRepo;
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
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('GET_LOCK')) {
        callOrder.push('GET_LOCK');
        expect(params?.[0]).toBe(SCHEDULE_TIME_SLOTS_MUTATE_LOCK_KEY);
        return [{ acquired: getLockResult }];
      }
      if (sql.includes('RELEASE_LOCK')) {
        callOrder.push('RELEASE_LOCK');
        if (releaseShouldThrow) {
          throw new Error('release failed');
        }
        return [{ released: 1 }];
      }
      return [];
    }),
    manager,
  };

  const dataSource = {
    createQueryRunner: jest.fn(() => queryRunner),
  };

  const listRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  let service: ScheduleTimeSlotsService;

  beforeEach(() => {
    jest.clearAllMocks();
    callOrder.length = 0;
    slotStore.clear();
    nextId = 1;
    entriesExist = false;
    getLockResult = 1;
    releaseShouldThrow = false;
    isTransactionActive = false;
    slotQbState.result = null;
    slotQbState.filters = {};

    service = new ScheduleTimeSlotsService(
      listRepo as never,
      entryRepo as never,
      dataSource as never,
    );
  });

  function seedSlot(partial: Record<string, unknown>) {
    const id = (partial.id as number) ?? nextId++;
    const row = {
      lessonNumber: null,
      name: `Slot ${id}`,
      startTime: '07:00:00',
      endTime: '07:40:00',
      displayOrder: id,
      slotType: ScheduleSlotType.CLASS,
      isActive: true,
      ...partial,
      id,
    };
    slotStore.set(id, row);
    if (typeof partial.id === 'number' && partial.id >= nextId) {
      nextId = partial.id + 1;
    }
    return row;
  }

  function expectCode(error: unknown, code: string) {
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({ code });
  }

  it('lifecycle success: connect → GET_LOCK → TX → COMMIT → RELEASE → release', async () => {
    await service.create({
      name: 'L1',
      startTime: '07:00',
      endTime: '07:40',
      displayOrder: 1,
      slotType: ScheduleSlotType.CLASS,
    });
    expect(callOrder).toEqual([
      'connect',
      'GET_LOCK',
      'startTransaction',
      'COMMIT',
      'RELEASE_LOCK',
      'release',
    ]);
  });

  it('33–35. COMMIT antes de RELEASE; release siempre', async () => {
    await service.create({
      name: 'L1',
      startTime: '07:00',
      endTime: '07:40',
      displayOrder: 1,
      slotType: ScheduleSlotType.CLASS,
    });
    const commitIdx = callOrder.indexOf('COMMIT');
    const releaseIdx = callOrder.indexOf('RELEASE_LOCK');
    expect(commitIdx).toBeGreaterThan(-1);
    expect(releaseIdx).toBeGreaterThan(commitIdx);
    expect(callOrder[callOrder.length - 1]).toBe('release');
  });

  it('34/36. error → ROLLBACK → RELEASE; release fail no tapa error', async () => {
    seedSlot({
      id: 1,
      startTime: '07:00:00',
      endTime: '07:40:00',
      displayOrder: 1,
      isActive: true,
    });
    releaseShouldThrow = true;
    await expect(
      service.create({
        name: 'Overlap',
        startTime: '07:20',
        endTime: '08:00',
        displayOrder: 2,
        slotType: ScheduleSlotType.CLASS,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(callOrder).toContain('ROLLBACK');
    expect(callOrder).toContain('RELEASE_LOCK');
    expect(callOrder[callOrder.length - 1]).toBe('release');
  });

  it('31. GET_LOCK 0 → SCHEDULE_TIME_SLOT_LOCK_TIMEOUT', async () => {
    getLockResult = 0;
    try {
      await service.create({
        name: 'X',
        startTime: '07:00',
        endTime: '07:40',
        displayOrder: 1,
        slotType: ScheduleSlotType.CLASS,
      });
      throw new Error('expected');
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect(
        (error as ServiceUnavailableException).getResponse(),
      ).toMatchObject({ code: 'SCHEDULE_TIME_SLOT_LOCK_TIMEOUT' });
    }
  });

  it('1. create CLASS solapado CLASS → reject', async () => {
    seedSlot({
      id: 1,
      startTime: '07:00:00',
      endTime: '07:40:00',
      displayOrder: 1,
      slotType: ScheduleSlotType.CLASS,
      isActive: true,
    });
    try {
      await service.create({
        name: 'B',
        startTime: '07:20',
        endTime: '08:00',
        displayOrder: 2,
        slotType: ScheduleSlotType.CLASS,
      });
      throw new Error('expected');
    } catch (e) {
      expectCode(e, 'SCHEDULE_TIME_SLOT_OVERLAP');
    }
  });

  it('2. CLASS solapado BREAK → reject', async () => {
    seedSlot({
      id: 1,
      startTime: '08:20:00',
      endTime: '08:35:00',
      displayOrder: 3,
      slotType: ScheduleSlotType.BREAK,
      isActive: true,
    });
    try {
      await service.create({
        name: 'Class',
        startTime: '08:00',
        endTime: '08:50',
        displayOrder: 4,
        slotType: ScheduleSlotType.CLASS,
      });
      throw new Error('expected');
    } catch (e) {
      expectCode(e, 'SCHEDULE_TIME_SLOT_OVERLAP');
    }
  });

  it('3. CLASS solapado LUNCH → reject', async () => {
    seedSlot({
      id: 1,
      startTime: '11:20:00',
      endTime: '12:10:00',
      displayOrder: 9,
      slotType: ScheduleSlotType.LUNCH,
      isActive: true,
    });
    try {
      await service.create({
        name: 'Class',
        startTime: '11:50',
        endTime: '12:30',
        displayOrder: 10,
        slotType: ScheduleSlotType.CLASS,
      });
      throw new Error('expected');
    } catch (e) {
      expectCode(e, 'SCHEDULE_TIME_SLOT_OVERLAP');
    }
  });

  it('4. BREAK solapado LUNCH → reject', async () => {
    seedSlot({
      id: 1,
      startTime: '11:20:00',
      endTime: '12:10:00',
      displayOrder: 9,
      slotType: ScheduleSlotType.LUNCH,
      isActive: true,
    });
    try {
      await service.create({
        name: 'Break',
        startTime: '12:00',
        endTime: '12:20',
        displayOrder: 10,
        slotType: ScheduleSlotType.BREAK,
      });
      throw new Error('expected');
    } catch (e) {
      expectCode(e, 'SCHEDULE_TIME_SLOT_OVERLAP');
    }
  });

  it('5. bordes A.end == B.start → permitido', async () => {
    seedSlot({
      id: 1,
      startTime: '07:00:00',
      endTime: '07:40:00',
      displayOrder: 1,
      isActive: true,
    });
    const created = await service.create({
      name: 'L2',
      startTime: '07:40',
      endTime: '08:20',
      displayOrder: 2,
      slotType: ScheduleSlotType.CLASS,
    });
    expect(created.startTime).toBe('07:40:00');
  });

  it('6. inactive solapado active → permitido', async () => {
    seedSlot({
      id: 1,
      startTime: '07:00:00',
      endTime: '07:40:00',
      displayOrder: 1,
      isActive: true,
    });
    const created = await service.create({
      name: 'Ghost',
      startTime: '07:20',
      endTime: '08:00',
      displayOrder: 1,
      slotType: ScheduleSlotType.CLASS,
      isActive: false,
    });
    expect(created.isActive).toBe(false);
  });

  it('7. activar inactive solapado → reject', async () => {
    seedSlot({
      id: 1,
      startTime: '07:00:00',
      endTime: '07:40:00',
      displayOrder: 1,
      isActive: true,
    });
    seedSlot({
      id: 2,
      startTime: '07:20:00',
      endTime: '08:00:00',
      displayOrder: 2,
      isActive: false,
    });
    try {
      await service.update(2, { isActive: true });
      throw new Error('expected');
    } catch (e) {
      expectCode(e, 'SCHEDULE_TIME_SLOT_OVERLAP');
    }
  });

  it('8. update range causando overlap → reject', async () => {
    seedSlot({
      id: 1,
      startTime: '07:00:00',
      endTime: '07:40:00',
      displayOrder: 1,
      isActive: true,
    });
    seedSlot({
      id: 2,
      startTime: '07:40:00',
      endTime: '08:20:00',
      displayOrder: 2,
      isActive: true,
    });
    try {
      await service.update(2, { startTime: '07:20:00', endTime: '08:00:00' });
      throw new Error('expected');
    } catch (e) {
      expectCode(e, 'SCHEDULE_TIME_SLOT_OVERLAP');
    }
  });

  it('9/16. update propio rango sin overlap y sin entries → ok', async () => {
    seedSlot({
      id: 1,
      startTime: '07:00:00',
      endTime: '07:40:00',
      displayOrder: 1,
      isActive: true,
    });
    const updated = await service.update(1, {
      startTime: '07:05:00',
      endTime: '07:45:00',
    });
    expect(updated.startTime).toBe('07:05:00');
    expect(updated.endTime).toBe('07:45:00');
  });

  it('10–12. slot con entries: start/end/type → reject', async () => {
    seedSlot({
      id: 1,
      startTime: '07:00:00',
      endTime: '07:40:00',
      displayOrder: 1,
      slotType: ScheduleSlotType.CLASS,
      isActive: true,
    });
    entriesExist = true;

    try {
      await service.update(1, { startTime: '07:10:00' });
      throw new Error('expected');
    } catch (e) {
      expect((e as ConflictException).getResponse()).toMatchObject({
        code: 'SCHEDULE_TIME_SLOT_IN_USE',
        operation: 'update_immutable_fields',
      });
    }
    try {
      await service.update(1, { endTime: '07:50:00' });
      throw new Error('expected');
    } catch (e) {
      expect((e as ConflictException).getResponse()).toMatchObject({
        code: 'SCHEDULE_TIME_SLOT_IN_USE',
        operation: 'update_immutable_fields',
      });
    }
    try {
      await service.update(1, {
        slotType: ScheduleSlotType.BREAK,
        lessonNumber: null,
      });
      throw new Error('expected');
    } catch (e) {
      expect((e as ConflictException).getResponse()).toMatchObject({
        code: 'SCHEDULE_TIME_SLOT_IN_USE',
        operation: 'update_immutable_fields',
      });
    }
  });

  it('13–15. con entries: deactivate + name + displayOrder libre', async () => {
    seedSlot({
      id: 1,
      startTime: '07:00:00',
      endTime: '07:40:00',
      displayOrder: 1,
      name: 'Old',
      isActive: true,
    });
    entriesExist = true;
    const updated = await service.update(1, {
      isActive: false,
      name: 'Renamed',
      displayOrder: 99,
    });
    expect(updated.isActive).toBe(false);
    expect(updated.name).toBe('Renamed');
    expect(updated.displayOrder).toBe(99);
    expect(entriesExist).toBe(true);
  });

  it('17. sin entries CLASS → BREAK con lessonNumber null', async () => {
    seedSlot({
      id: 1,
      startTime: '07:00:00',
      endTime: '07:40:00',
      displayOrder: 1,
      lessonNumber: 1,
      slotType: ScheduleSlotType.CLASS,
      isActive: true,
    });
    const updated = await service.update(1, {
      slotType: ScheduleSlotType.BREAK,
      lessonNumber: null,
    });
    expect(updated.slotType).toBe(ScheduleSlotType.BREAK);
    expect(updated.lessonNumber).toBeNull();
  });

  it('18. create active duplicate displayOrder → reject', async () => {
    seedSlot({ id: 1, displayOrder: 5, isActive: true });
    try {
      await service.create({
        name: 'Dup',
        startTime: '16:30',
        endTime: '17:00',
        displayOrder: 5,
        slotType: ScheduleSlotType.CLASS,
      });
      throw new Error('expected');
    } catch (e) {
      expectCode(e, 'SCHEDULE_TIME_SLOT_DISPLAY_ORDER_CONFLICT');
    }
  });

  it('19. create inactive duplicate displayOrder → permitido', async () => {
    seedSlot({ id: 1, displayOrder: 5, isActive: true });
    const created = await service.create({
      name: 'Dup inactive',
      startTime: '16:30',
      endTime: '17:00',
      displayOrder: 5,
      slotType: ScheduleSlotType.CLASS,
      isActive: false,
    });
    expect(created.displayOrder).toBe(5);
    expect(created.isActive).toBe(false);
  });

  it('20. update active a displayOrder ocupado → reject', async () => {
    seedSlot({
      id: 1,
      displayOrder: 1,
      startTime: '07:00:00',
      endTime: '07:40:00',
    });
    seedSlot({
      id: 2,
      displayOrder: 2,
      startTime: '07:40:00',
      endTime: '08:20:00',
    });
    try {
      await service.update(2, { displayOrder: 1 });
      throw new Error('expected');
    } catch (e) {
      expectCode(e, 'SCHEDULE_TIME_SLOT_DISPLAY_ORDER_CONFLICT');
    }
  });

  it('21. activar inactive con displayOrder ocupado → reject', async () => {
    seedSlot({ id: 1, displayOrder: 5, isActive: true });
    seedSlot({
      id: 2,
      displayOrder: 5,
      isActive: false,
      startTime: '16:30:00',
      endTime: '17:00:00',
    });
    try {
      await service.update(2, { isActive: true });
      throw new Error('expected');
    } catch (e) {
      expectCode(e, 'SCHEDULE_TIME_SLOT_DISPLAY_ORDER_CONFLICT');
    }
  });

  it('22. update manteniendo propio displayOrder → permitido', async () => {
    seedSlot({ id: 1, displayOrder: 3, name: 'A' });
    const updated = await service.update(1, { name: 'B', displayOrder: 3 });
    expect(updated.displayOrder).toBe(3);
    expect(updated.name).toBe('B');
  });

  it('23–24. BREAK/LUNCH + lessonNumber → reject', async () => {
    await expect(
      service.create({
        name: 'Bad break',
        startTime: '08:20',
        endTime: '08:35',
        displayOrder: 3,
        slotType: ScheduleSlotType.BREAK,
        lessonNumber: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.create({
        name: 'Bad lunch',
        startTime: '11:20',
        endTime: '12:10',
        displayOrder: 9,
        slotType: ScheduleSlotType.LUNCH,
        lessonNumber: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('25/29. CLASS + lessonNumber o null → permitido', async () => {
    const a = await service.create({
      name: 'L1',
      startTime: '07:00',
      endTime: '07:40',
      displayOrder: 1,
      slotType: ScheduleSlotType.CLASS,
      lessonNumber: 1,
    });
    expect(a.lessonNumber).toBe(1);
    const b = await service.create({
      name: 'L2',
      startTime: '07:40',
      endTime: '08:20',
      displayOrder: 2,
      slotType: ScheduleSlotType.CLASS,
      lessonNumber: null,
    });
    expect(b.lessonNumber).toBeNull();
  });

  it('26. CLASS active duplicate lessonNumber → reject', async () => {
    seedSlot({
      id: 1,
      lessonNumber: 3,
      slotType: ScheduleSlotType.CLASS,
      isActive: true,
      startTime: '07:00:00',
      endTime: '07:40:00',
      displayOrder: 1,
    });
    try {
      await service.create({
        name: 'Dup lesson',
        startTime: '07:40',
        endTime: '08:20',
        displayOrder: 2,
        slotType: ScheduleSlotType.CLASS,
        lessonNumber: 3,
      });
      throw new Error('expected');
    } catch (e) {
      expectCode(e, 'SCHEDULE_TIME_SLOT_LESSON_NUMBER_CONFLICT');
    }
  });

  it('27. CLASS inactive duplicate lessonNumber → permitido', async () => {
    seedSlot({
      id: 1,
      lessonNumber: 3,
      isActive: true,
      startTime: '07:00:00',
      endTime: '07:40:00',
      displayOrder: 1,
    });
    const created = await service.create({
      name: 'Inactive dup',
      startTime: '16:30',
      endTime: '17:00',
      displayOrder: 99,
      slotType: ScheduleSlotType.CLASS,
      lessonNumber: 3,
      isActive: false,
    });
    expect(created.lessonNumber).toBe(3);
  });

  it('28. activar CLASS con lessonNumber ocupado → reject', async () => {
    seedSlot({
      id: 1,
      lessonNumber: 3,
      isActive: true,
      startTime: '07:00:00',
      endTime: '07:40:00',
      displayOrder: 1,
    });
    seedSlot({
      id: 2,
      lessonNumber: 3,
      isActive: false,
      startTime: '16:30:00',
      endTime: '17:00:00',
      displayOrder: 99,
    });
    try {
      await service.update(2, { isActive: true });
      throw new Error('expected');
    } catch (e) {
      expectCode(e, 'SCHEDULE_TIME_SLOT_LESSON_NUMBER_CONFLICT');
    }
  });

  it('39. delete sin entries → success', async () => {
    seedSlot({ id: 1 });
    entriesExist = false;
    await expect(service.remove(1)).resolves.toEqual({ deleted: true });
    expect(slotStore.has(1)).toBe(false);
  });

  it('40–42. delete con entries → IN_USE; entries no borradas; pessimistic', async () => {
    seedSlot({ id: 1 });
    entriesExist = true;
    try {
      await service.remove(1);
      throw new Error('expected');
    } catch (e) {
      expectCode(e, 'SCHEDULE_TIME_SLOT_IN_USE');
      expect((e as ConflictException).getResponse()).toMatchObject({
        operation: 'delete',
      });
    }
    expect(slotStore.has(1)).toBe(true);
    expect(callOrder).toContain('pessimistic_write');
    expect(entryRepo.exists).toHaveBeenCalled();
  });

  it('37. create/update/delete usan createQueryRunner', async () => {
    await service.create({
      name: 'A',
      startTime: '07:00',
      endTime: '07:40',
      displayOrder: 1,
      slotType: ScheduleSlotType.CLASS,
    });
    seedSlot({
      id: 10,
      displayOrder: 10,
      startTime: '10:00:00',
      endTime: '10:40:00',
    });
    await service.update(10, { name: 'Renamed' });
    seedSlot({ id: 11 });
    await service.remove(11);
    expect(dataSource.createQueryRunner).toHaveBeenCalledTimes(3);
  });

  it('requireAssignableSlot BREAK/LUNCH/inactive', async () => {
    listRepo.findOne.mockResolvedValueOnce({
      id: 3,
      slotType: ScheduleSlotType.BREAK,
      isActive: true,
    });
    await expect(service.requireAssignableSlot(3)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    listRepo.findOne.mockResolvedValueOnce({
      id: 9,
      slotType: ScheduleSlotType.LUNCH,
      isActive: true,
    });
    await expect(service.requireAssignableSlot(9)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    listRepo.findOne.mockResolvedValueOnce({
      id: 1,
      slotType: ScheduleSlotType.CLASS,
      isActive: false,
    });
    await expect(service.requireAssignableSlot(1)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('list ordenado por displayOrder (repo list)', async () => {
    listRepo.find.mockResolvedValue([]);
    await service.list();
    expect(listRepo.find).toHaveBeenCalledWith({
      order: { displayOrder: 'ASC', id: 'ASC' },
    });
  });

  it('start < end requerido en create', async () => {
    await expect(
      service.create({
        name: 'Bad',
        startTime: '08:00:00',
        endTime: '07:00:00',
        displayOrder: 1,
        slotType: ScheduleSlotType.CLASS,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('delete slot inexistente → 404', async () => {
    await expect(service.remove(999)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('GET_LOCK NULL → LOCK_ERROR', async () => {
    getLockResult = null;
    try {
      await service.create({
        name: 'X',
        startTime: '07:00',
        endTime: '07:40',
        displayOrder: 1,
        slotType: ScheduleSlotType.CLASS,
      });
      throw new Error('expected');
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect(
        (error as ServiceUnavailableException).getResponse(),
      ).toMatchObject({ code: 'SCHEDULE_TIME_SLOT_LOCK_ERROR' });
    }
  });
});
