import { BadRequestException, ConflictException } from '@nestjs/common';
import { GroupEnrollmentStatus } from '../../../../common/enums/group-enrollment-status.enum';
import { GroupEnrollmentsService } from './group-enrollments.service';

describe('GroupEnrollmentsService Phase 0.1', () => {
  const enrollmentRepo = {
    create: jest.fn((data) => ({ ...data })),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const manager = {
    findOne: jest.fn(),
    getRepository: jest.fn(() => enrollmentRepo),
  };

  const dataSource = {
    transaction: jest.fn(async (fn: (m: typeof manager) => unknown) => fn(manager)),
  };

  const repository = {
    createQueryBuilder: jest.fn(),
  };

  let service: GroupEnrollmentsService;
  let lockCalls: unknown[];

  function mockOverlapQb(result: unknown) {
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(result),
    };
    enrollmentRepo.createQueryBuilder.mockReturnValue(qb);
    return qb;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    lockCalls = [];
    service = new GroupEnrollmentsService(
      repository as never,
      {} as never,
      {} as never,
      dataSource as never,
    );

    manager.findOne.mockImplementation(async (entity: { name?: string }, opts: { lock?: unknown }) => {
      lockCalls.push(opts?.lock);
      if (entity?.name === 'User' || opts) {
        // User lock path
        if (opts?.lock) {
          return {
            id: 7,
            status: 'ACTIVE',
            userRoles: [{ role: { name: 'Estudiante', status: 'ACTIVE' } }],
          };
        }
      }
      return { id: 20, academicPeriodId: 3 };
    });

    // Distinguish User vs Group by call order / lock presence
    manager.findOne.mockImplementation(async (_entity, opts: { where?: { id?: number }; lock?: unknown }) => {
      if (opts?.lock) {
        lockCalls.push(opts.lock);
        return {
          id: opts.where?.id ?? 7,
          status: 'ACTIVE',
          userRoles: [{ role: { name: 'Estudiante', status: 'ACTIVE' } }],
        };
      }
      return { id: opts?.where?.id ?? 20, academicPeriodId: 3 };
    });
  });

  it('create válido -> OK and requests pessimistic_write on student', async () => {
    mockOverlapQb(null);
    enrollmentRepo.save.mockResolvedValue({
      id: 1,
      userId: 7,
      groupId: 20,
      startsOn: '2026-02-01',
      endsOn: null,
      status: GroupEnrollmentStatus.ACTIVE,
    });

    await expect(
      service.create({ userId: 7, groupId: 20, startsOn: '2026-02-01' }),
    ).resolves.toMatchObject({ id: 1, status: GroupEnrollmentStatus.ACTIVE });

    expect(dataSource.transaction).toHaveBeenCalled();
    expect(lockCalls).toContainEqual({ mode: 'pessimistic_write' });
  });

  it('overlap secuencial -> reject', async () => {
    mockOverlapQb({ id: 9 });
    await expect(
      service.create({ userId: 7, groupId: 20, startsOn: '2026-03-01' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('ends_on < starts_on -> reject', async () => {
    await expect(
      service.create({
        userId: 7,
        groupId: 20,
        startsOn: '2026-05-01',
        endsOn: '2026-04-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('transfer válido -> anterior cierra + nuevo crea + lock', async () => {
    const active = {
      id: 1,
      userId: 7,
      groupId: 20,
      startsOn: '2026-02-01',
      endsOn: null,
      status: GroupEnrollmentStatus.ACTIVE,
    };
    const activeQb = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(active),
    };
    const overlapQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    enrollmentRepo.createQueryBuilder
      .mockReturnValueOnce(activeQb)
      .mockReturnValueOnce(overlapQb);
    enrollmentRepo.save
      .mockResolvedValueOnce({
        ...active,
        endsOn: '2026-04-30',
        status: GroupEnrollmentStatus.ENDED,
      })
      .mockResolvedValueOnce({
        id: 2,
        userId: 7,
        groupId: 21,
        startsOn: '2026-05-01',
        endsOn: null,
        status: GroupEnrollmentStatus.ACTIVE,
      });

    const result = await service.transfer({
      userId: 7,
      newGroupId: 21,
      effectiveOn: '2026-05-01',
    });

    expect(activeQb.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(lockCalls).toContainEqual({ mode: 'pessimistic_write' });
    expect(result.closed).toMatchObject({
      endsOn: '2026-04-30',
      status: GroupEnrollmentStatus.ENDED,
    });
    expect(result.opened).toMatchObject({
      groupId: 21,
      startsOn: '2026-05-01',
    });
  });

  it('error al crear nuevo durante transfer -> transaction rejects (rollback)', async () => {
    const active = {
      id: 1,
      userId: 7,
      groupId: 20,
      startsOn: '2026-02-01',
      endsOn: null,
      status: GroupEnrollmentStatus.ACTIVE,
    };
    const activeQb = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(active),
    };
    const overlapQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    enrollmentRepo.createQueryBuilder
      .mockReturnValueOnce(activeQb)
      .mockReturnValueOnce(overlapQb);
    enrollmentRepo.save
      .mockResolvedValueOnce({
        ...active,
        endsOn: '2026-04-30',
        status: GroupEnrollmentStatus.ENDED,
      })
      .mockRejectedValueOnce(new Error('insert failed'));

    await expect(
      service.transfer({
        userId: 7,
        newGroupId: 21,
        effectiveOn: '2026-05-01',
      }),
    ).rejects.toThrow('insert failed');
    expect(dataSource.transaction).toHaveBeenCalled();
  });

  it('as-of invalid date -> 400', async () => {
    await expect(service.findGroupAsOf(7, 'not-a-date')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('as-of invalid userId -> 400', async () => {
    await expect(
      service.findGroupAsOf(Number.NaN, '2026-03-15'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('as-of before/after transfer window returns enrollment', async () => {
    const enrollment = {
      id: 1,
      groupId: 20,
      startsOn: '2026-02-01',
      endsOn: '2026-04-30',
    };
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(enrollment),
    };
    repository.createQueryBuilder.mockReturnValue(qb);
    await expect(service.findGroupAsOf(7, '2026-03-15')).resolves.toEqual(
      enrollment,
    );
  });
});
