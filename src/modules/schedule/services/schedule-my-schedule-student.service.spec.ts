import { ScheduleEntriesService } from './schedule-entries.service';

describe('ScheduleEntriesService — student my-schedule (E1)', () => {
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
  };

  const timeSlots = { list: jest.fn() };
  const groupEnrollments = {
    findGroupAsOf: jest.fn(),
    findLatestForPeriod: jest.fn(),
  };

  let service: ScheduleEntriesService;

  beforeEach(() => {
    jest.clearAllMocks();
    andWhereCalls.length = 0;
    listQb.getMany.mockResolvedValue([]);
    timeSlots.list.mockResolvedValue([{ id: 1, isActive: true }]);
    service = new ScheduleEntriesService(
      entryRepo as never,
      { findOne: jest.fn() } as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      timeSlots as never,
      { resolveOffering: jest.fn() } as never,
      groupEnrollments as never,
      { createQueryRunner: jest.fn() } as never,
    );
  });

  it('1. estudiante con matrícula → solo entries de su group', async () => {
    groupEnrollments.findGroupAsOf.mockResolvedValue({ groupId: 3 });
    await service.listOwnForStudent(521);
    expect(andWhereCalls.some((c) => c.params?.studentGroupId === 3)).toBe(
      true,
    );
    expect(
      andWhereCalls.some((c) =>
        String(c.sql).includes('ta.groupId = :studentGroupId'),
      ),
    ).toBe(true);
  });

  it('2/15. entry de otro group no entra (scope SQL group fijo)', async () => {
    groupEnrollments.findGroupAsOf.mockResolvedValue({ groupId: 3 });
    await service.listOwnForStudent(521);
    const keys = andWhereCalls.flatMap((c) => Object.keys(c.params ?? {}));
    expect(keys).toContain('studentGroupId');
    expect(keys).not.toContain('groupId');
    expect(keys).not.toContain('teacherId');
    expect(keys).not.toContain('actorUserId');
  });

  it('3. dos estudiantes → grupos distintos en query', async () => {
    groupEnrollments.findGroupAsOf.mockResolvedValueOnce({ groupId: 3 });
    await service.listOwnForStudent(2);
    expect(andWhereCalls.at(-1)?.params).toEqual({ studentGroupId: 3 });

    andWhereCalls.length = 0;
    groupEnrollments.findGroupAsOf.mockResolvedValueOnce({ groupId: 7 });
    await service.listOwnForStudent(3);
    expect(andWhereCalls.at(-1)?.params).toEqual({ studentGroupId: 7 });
  });

  it('4–5. sin matrícula → [] pero timeSlots presentes', async () => {
    groupEnrollments.findGroupAsOf.mockResolvedValue(null);
    const view = await service.getMySchedule({
      id: 521,
      roles: ['Estudiante'],
    });
    expect(view.entries).toEqual([]);
    expect(view.timeSlots).toHaveLength(1);
    expect(entryRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('6. periodId → findLatestForPeriod + group scope', async () => {
    groupEnrollments.findLatestForPeriod.mockResolvedValue({ groupId: 3 });
    await service.listOwnForStudent(521, { periodId: 1 });
    expect(groupEnrollments.findLatestForPeriod).toHaveBeenCalledWith(521, 1);
    expect(groupEnrollments.findGroupAsOf).not.toHaveBeenCalled();
    expect(andWhereCalls.some((c) => c.params?.studentGroupId === 3)).toBe(
      true,
    );
    expect(andWhereCalls.some((c) => c.params?.periodId === 1)).toBe(true);
  });

  it('7. periodId histórico ENDED enrollment se resuelve', async () => {
    groupEnrollments.findLatestForPeriod.mockResolvedValue({
      groupId: 3,
      status: 'ENDED',
    });
    await service.listOwnForStudent(521, { periodId: 1 });
    expect(andWhereCalls.some((c) => c.params?.studentGroupId === 3)).toBe(
      true,
    );
  });

  it('8. múltiples enrollments → latest group from findLatestForPeriod', async () => {
    groupEnrollments.findLatestForPeriod.mockResolvedValue({ groupId: 9 });
    await service.listOwnForStudent(521, { periodId: 1 });
    expect(andWhereCalls.some((c) => c.params?.studentGroupId === 9)).toBe(
      true,
    );
  });

  it('9. periodId sin enrollment → []', async () => {
    groupEnrollments.findLatestForPeriod.mockResolvedValue(null);
    await expect(
      service.listOwnForStudent(521, { periodId: 99 }),
    ).resolves.toEqual([]);
    expect(entryRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('10–11. dayOfWeek / period+day AND con group scope', async () => {
    groupEnrollments.findLatestForPeriod.mockResolvedValue({ groupId: 3 });
    await service.listOwnForStudent(521, { periodId: 1, dayOfWeek: 2 });
    expect(andWhereCalls.some((c) => c.params?.studentGroupId === 3)).toBe(
      true,
    );
    expect(andWhereCalls.some((c) => c.params?.periodId === 1)).toBe(true);
    expect(andWhereCalls.some((c) => c.params?.dayOfWeek === 2)).toBe(true);
  });

  it('16. student getMySchedule no llama list() admin', async () => {
    groupEnrollments.findGroupAsOf.mockResolvedValue({ groupId: 3 });
    const listSpy = jest.spyOn(service, 'list');
    await service.getMySchedule({ id: 521, roles: ['Estudiante'] });
    expect(listSpy).not.toHaveBeenCalled();
  });

  it('getMySchedule Estudiante usa listOwnForStudent', async () => {
    const spy = jest.spyOn(service, 'listOwnForStudent').mockResolvedValue([]);
    await service.getMySchedule(
      { id: 521, roles: ['Estudiante'] },
      { periodId: 1 },
    );
    expect(spy).toHaveBeenCalledWith(521, { periodId: 1 });
  });

  it('unsupported roles → entries [] sin listOwn', async () => {
    const own = jest.spyOn(service, 'listOwn');
    const student = jest.spyOn(service, 'listOwnForStudent');
    const view = await service.getMySchedule({ id: 10, roles: [] });
    expect(view.entries).toEqual([]);
    expect(view.timeSlots).toHaveLength(1);
    expect(own).not.toHaveBeenCalled();
    expect(student).not.toHaveBeenCalled();
  });
});
