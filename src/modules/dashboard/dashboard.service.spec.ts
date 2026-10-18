import { DashboardService } from './dashboard.service';
import { SpecialtyKind } from '../../common/enums/specialty-kind.enum';
import { UserStatus } from '../../common/enums/user-status.enum';

describe('DashboardService', () => {
  let service: DashboardService;
  let userRepo: { count: jest.Mock };
  let roleRepo: { count: jest.Mock };
  let academicPeriodRepo: { count: jest.Mock };
  let userRoleRepo: { createQueryBuilder: jest.Mock };
  let sectionRepo: { count: jest.Mock };
  let specialtyRepo: { count: jest.Mock };

  beforeEach(() => {
    userRepo = {
      count: jest.fn().mockImplementation((options) => {
        if (options?.where?.status === UserStatus.ACTIVE) {
          return Promise.resolve(10);
        }
        return Promise.resolve(15);
      }),
    };

    roleRepo = {
      count: jest.fn().mockResolvedValue(4),
    };

    academicPeriodRepo = {
      count: jest.fn().mockResolvedValue(2),
    };

    const queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        { role: 'DOCENTE', count: '5' },
        { role: 'ESTUDIANTE', count: '10' },
      ]),
    };

    userRoleRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };

    sectionRepo = {
      count: jest.fn().mockResolvedValue(8),
    };

    specialtyRepo = {
      count: jest.fn().mockImplementation((options) => {
        if (options?.where?.kind === SpecialtyKind.EXPLORATORY_WORKSHOP) {
          return Promise.resolve(3);
        }
        if (options?.where?.kind === SpecialtyKind.TECHNICAL_SPECIALTY) {
          return Promise.resolve(5);
        }
        return Promise.resolve(0);
      }),
    };

    service = new DashboardService(
      userRepo as never,
      roleRepo as never,
      academicPeriodRepo as never,
      userRoleRepo as never,
      sectionRepo as never,
      specialtyRepo as never,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return aggregated dashboard metrics', async () => {
    const summary = await service.getSummary();

    expect(summary).toEqual({
      totalUsers: 15,
      activeUsers: 10,
      totalRoles: 4,
      totalAcademicPeriods: 2,
      totalSections: 8,
      totalExploratoryWorkshops: 3,
      totalSpecialties: 5,
      usersByRole: [
        { role: 'DOCENTE', count: 5 },
        { role: 'ESTUDIANTE', count: 10 },
      ],
    });

    expect(userRepo.count).toHaveBeenCalledTimes(2);
    expect(roleRepo.count).toHaveBeenCalledTimes(1);
    expect(academicPeriodRepo.count).toHaveBeenCalledTimes(1);
    expect(sectionRepo.count).toHaveBeenCalledTimes(1);
    expect(specialtyRepo.count).toHaveBeenCalledTimes(2);
    expect(userRoleRepo.createQueryBuilder).toHaveBeenCalledWith('ur');
  });
});
