import { BadRequestException } from '@nestjs/common';
import { ScheduleEntriesService } from './schedule-entries.service';

describe('ScheduleEntriesService — listOwn / getMySchedule (D1)', () => {
  const andWhereCalls: Array<{ sql: string; params?: Record<string, unknown> }> =
    [];

  type Qb = {
    leftJoinAndSelect: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    addOrderBy: jest.Mock;
    getMany: jest.Mock;
  };

  const listQb = {} as Qb;
  listQb.leftJoinAndSelect = jest.fn().mockReturnValue(listQb);
  listQb.andWhere = jest.fn((sql: string, params?: Record<string, unknown>) => {
    andWhereCalls.push({ sql, params });
    return listQb;
  });
  listQb.orderBy = jest.fn().mockReturnValue(listQb);
  listQb.addOrderBy = jest.fn().mockReturnValue(listQb);
  listQb.getMany = jest.fn();

  const entryRepo = {
    createQueryBuilder: jest.fn(() => listQb),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const timeSlots = {
    list: jest.fn(),
    requireAssignableSlot: jest.fn(),
  };

  const eligibility = {
    resolveOffering: jest.fn(),
    assertOfferingAllowedForGroup: jest.fn(),
  };

  const groupEnrollments = {
    findGroupAsOf: jest.fn(),
    findLatestForPeriod: jest.fn(),
  };

  const dataSource = { createQueryRunner: jest.fn() };

  let service: ScheduleEntriesService;

  beforeEach(() => {
    jest.clearAllMocks();
    andWhereCalls.length = 0;
    listQb.getMany.mockResolvedValue([]);
    timeSlots.list.mockResolvedValue([
      {
        id: 1,
        lessonNumber: 1,
        name: 'L1',
        startTime: '07:00:00',
        endTime: '07:40:00',
        displayOrder: 1,
        slotType: 'CLASS',
        isActive: true,
      },
    ]);
    groupEnrollments.findGroupAsOf.mockResolvedValue(null);
    groupEnrollments.findLatestForPeriod.mockResolvedValue(null);
    service = new ScheduleEntriesService(
      entryRepo as never,
      { findOne: jest.fn() } as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      timeSlots as never,
      eligibility as never,
      groupEnrollments as never,
      dataSource as never,
    );
  });

  it('5/18. listOwn siempre aplica actorUserId en query (no dump global)', async () => {
    await service.listOwn(522);
    expect(entryRepo.createQueryBuilder).toHaveBeenCalledWith('entry');
    expect(andWhereCalls.some((c) => c.params?.actorUserId === 522)).toBe(true);
    expect(
      andWhereCalls.some((c) =>
        String(c.sql).includes('ta.userId = :actorUserId'),
      ),
    ).toBe(true);
  });

  it('2. actor 522 → filtro actorUserId=522', async () => {
    await service.listOwn(522, {});
    expect(andWhereCalls.find((c) => c.params?.actorUserId)?.params).toEqual({
      actorUserId: 522,
    });
  });

  it('3. actor 520 → filtro actorUserId=520', async () => {
    await service.listOwn(520, {});
    expect(andWhereCalls.find((c) => c.params?.actorUserId)?.params).toEqual({
      actorUserId: 520,
    });
  });

  it('4. teacherId externo no existe en listOwn API (solo actorUserId)', async () => {
    await service.listOwn(522, { periodId: 1 });
    const keys = andWhereCalls.flatMap((c) => Object.keys(c.params ?? {}));
    expect(keys).toContain('actorUserId');
    expect(keys).not.toContain('teacherId');
  });

  it('6–8. periodId y dayOfWeek se combinan con actor scope', async () => {
    await service.listOwn(522, { periodId: 1, dayOfWeek: 3 });
    expect(andWhereCalls.some((c) => c.params?.actorUserId === 522)).toBe(true);
    expect(andWhereCalls.some((c) => c.params?.periodId === 1)).toBe(true);
    expect(andWhereCalls.some((c) => c.params?.dayOfWeek === 3)).toBe(true);
  });

  it('9–10. sin entries → [] pero timeSlots se devuelven', async () => {
    listQb.getMany.mockResolvedValue([]);
    const view = await service.getMySchedule({ id: 522, roles: ['Docente'] });
    expect(view.entries).toEqual([]);
    expect(view.timeSlots).toHaveLength(1);
    expect(timeSlots.list).toHaveBeenCalled();
  });

  it('16. getMySchedule usa listOwn (actor) + timeSlots.list, no list() admin', async () => {
    const listSpy = jest.spyOn(service, 'list');
    const ownSpy = jest.spyOn(service, 'listOwn').mockResolvedValue([]);
    await service.getMySchedule(
      { id: 522, roles: ['Docente'] },
      { periodId: 1 },
    );
    expect(ownSpy).toHaveBeenCalledWith(522, { periodId: 1 });
    expect(listSpy).not.toHaveBeenCalled();
    expect(timeSlots.list).toHaveBeenCalled();
  });

  it('21. Docente no usa GroupEnrollment', async () => {
    await service.getMySchedule({ id: 522, roles: ['Docente'] });
    expect(groupEnrollments.findGroupAsOf).not.toHaveBeenCalled();
    expect(groupEnrollments.findLatestForPeriod).not.toHaveBeenCalled();
  });

  it('22. Docente + Estudiante → teacher scope', async () => {
    const ownSpy = jest.spyOn(service, 'listOwn').mockResolvedValue([]);
    const studentSpy = jest
      .spyOn(service, 'listOwnForStudent')
      .mockResolvedValue([]);
    await service.getMySchedule({
      id: 99,
      roles: ['Docente', 'Estudiante'],
    });
    expect(ownSpy).toHaveBeenCalledWith(99, {});
    expect(studentSpy).not.toHaveBeenCalled();
  });

  it('23. Admin manual my-schedule → teacher scope (nunca list global)', async () => {
    const listSpy = jest.spyOn(service, 'list');
    const ownSpy = jest.spyOn(service, 'listOwn').mockResolvedValue([]);
    await service.getMySchedule({ id: 1, roles: ['ADMIN'] });
    expect(ownSpy).toHaveBeenCalledWith(1, {});
    expect(listSpy).not.toHaveBeenCalled();
  });

  it('actor inválido → BadRequest', async () => {
    await expect(service.listOwn(0)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listOwn(-1)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('11–15. list admin sin actorUserId (regresión filtros)', async () => {
    await service.list({
      teacherId: 5,
      groupId: 3,
      periodId: 1,
      dayOfWeek: 2,
    });
    const keys = andWhereCalls.flatMap((c) => Object.keys(c.params ?? {}));
    expect(keys).toContain('teacherId');
    expect(keys).toContain('groupId');
    expect(keys).toContain('periodId');
    expect(keys).toContain('dayOfWeek');
    expect(keys).not.toContain('actorUserId');
  });

  it('admin list sin filtros → sin andWhere de teacher (global)', async () => {
    await service.list({});
    expect(andWhereCalls.every((c) => c.params?.teacherId == null)).toBe(true);
    expect(andWhereCalls.every((c) => c.params?.actorUserId == null)).toBe(
      true,
    );
  });
});
