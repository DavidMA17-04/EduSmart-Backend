import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AttendanceCalendarExceptionType } from '../../../common/enums/attendance-calendar-exception-type.enum';
import { AttendanceCalendarExceptionsService } from './attendance-calendar-exceptions.service';

describe('AttendanceCalendarExceptionsService', () => {
  const exceptionsRepo = {
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => ({
      id: 1,
      createdAt: new Date('2026-09-19T12:00:00Z'),
      updatedAt: new Date('2026-09-19T12:00:00Z'),
      ...x,
    })),
    findOne: jest.fn(),
    find: jest.fn(),
    remove: jest.fn(async () => undefined),
    createQueryBuilder: jest.fn(),
  };
  const periodsRepo = {
    findOne: jest.fn(),
  };
  const sectionsRepo = {
    findOne: jest.fn(),
  };

  const service = new AttendanceCalendarExceptionsService(
    exceptionsRepo as never,
    periodsRepo as never,
    sectionsRepo as never,
  );

  const actor = {
    id: 3,
    email: 'admin@test.com',
    roles: [],
    permissions: [],
    mustChangePassword: false,
  };

  const period = {
    id: 10,
    name: '2026',
    startDate: '2026-02-01',
    endDate: '2026-11-30',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    periodsRepo.findOne.mockResolvedValue(period);
    sectionsRepo.findOne.mockResolvedValue(null);
    exceptionsRepo.create.mockImplementation((x) => x);
    exceptionsRepo.save.mockImplementation(async (x) => ({
      id: x.id ?? 1,
      createdAt: new Date('2026-09-19T12:00:00Z'),
      updatedAt: new Date('2026-09-19T12:00:00Z'),
      ...x,
    }));
  });

  it('create persists a valid SUSPENDED window inside the period', async () => {
    const result = await service.create(
      {
        academicPeriodId: 10,
        title: 'Semana de Exámenes I',
        startDate: '2026-05-12',
        endDate: '2026-05-16',
        exceptionType: AttendanceCalendarExceptionType.SUSPENDED,
      },
      actor,
    );

    expect(result.exceptionType).toBe(AttendanceCalendarExceptionType.SUSPENDED);
    expect(result.startDate).toBe('2026-05-12');
    expect(exceptionsRepo.save).toHaveBeenCalled();
  });

  it('create rejects endDate before startDate', async () => {
    await expect(
      service.create(
        {
          academicPeriodId: 10,
          title: 'Rango inválido',
          startDate: '2026-05-16',
          endDate: '2026-05-12',
          exceptionType: AttendanceCalendarExceptionType.AUTO_JUSTIFIED,
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create rejects dates outside the academic period', async () => {
    await expect(
      service.create(
        {
          academicPeriodId: 10,
          title: 'Fuera de período',
          startDate: '2026-01-01',
          endDate: '2026-01-05',
          exceptionType: AttendanceCalendarExceptionType.SUSPENDED,
        },
        actor,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'ATTENDANCE_EXCEPTION_OUTSIDE_PERIOD',
      }),
    });
  });

  it('create rejects unknown academic period', async () => {
    periodsRepo.findOne.mockResolvedValue(null);
    await expect(
      service.create(
        {
          academicPeriodId: 999,
          title: 'Sin período',
          startDate: '2026-05-12',
          endDate: '2026-05-16',
          exceptionType: AttendanceCalendarExceptionType.SUSPENDED,
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('create rejects section from another period', async () => {
    sectionsRepo.findOne.mockResolvedValue({
      id: 2,
      academicPeriodId: 99,
    });
    await expect(
      service.create(
        {
          academicPeriodId: 10,
          sectionId: 2,
          title: 'Sección ajena',
          startDate: '2026-05-12',
          endDate: '2026-05-16',
          exceptionType: AttendanceCalendarExceptionType.SUSPENDED,
        },
        actor,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'ATTENDANCE_EXCEPTION_SECTION_PERIOD_MISMATCH',
      }),
    });
  });

  it('findActiveForDate prefers section-scoped over period-wide', async () => {
    const getMany = jest.fn().mockResolvedValue([
      {
        id: 1,
        academicPeriodId: 10,
        sectionId: null,
        title: 'Global',
        description: null,
        startDate: '2026-05-12',
        endDate: '2026-05-16',
        exceptionType: AttendanceCalendarExceptionType.SUSPENDED,
        createdByUserId: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        academicPeriodId: 10,
        sectionId: 5,
        title: '10mo',
        description: null,
        startDate: '2026-05-12',
        endDate: '2026-05-16',
        exceptionType: AttendanceCalendarExceptionType.AUTO_JUSTIFIED,
        createdByUserId: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    exceptionsRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany,
    });

    const active = await service.findActiveForDate({
      date: '2026-05-14',
      academicPeriodId: 10,
      sectionId: 5,
    });

    expect(active?.id).toBe(2);
    expect(active?.exceptionType).toBe(
      AttendanceCalendarExceptionType.AUTO_JUSTIFIED,
    );
  });

  it('findActiveForDate returns null when no overlap', async () => {
    exceptionsRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    });

    const active = await service.findActiveForDate({
      date: '2026-06-01',
      academicPeriodId: 10,
      sectionId: 5,
    });
    expect(active).toBeNull();
  });
});
