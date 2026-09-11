import { PublicService } from './public.service';
import { SpecialtyKind } from '../../common/enums/specialty-kind.enum';
import { UserStatus } from '../../common/enums/user-status.enum';

describe('PublicService.getCampusSnapshot', () => {
  const userRepo = {
    count: jest.fn(),
  };
  const specialtyRepo = {
    count: jest.fn(),
  };
  const sectionRepo = {
    count: jest.fn(),
  };

  const service = new PublicService(
    userRepo as never,
    specialtyRepo as never,
    sectionRepo as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns aggregate counts only (no sensitive fields)', async () => {
    userRepo.count
      .mockResolvedValueOnce(120)
      .mockResolvedValueOnce(95);
    sectionRepo.count.mockResolvedValue(8);
    specialtyRepo.count
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(7);

    const result = await service.getCampusSnapshot();

    expect(result).toEqual({
      totalUsers: 120,
      activeUsers: 95,
      totalSections: 8,
      totalExploratoryWorkshops: 12,
      totalSpecialties: 7,
    });
    expect(result).not.toHaveProperty('usersByRole');
    expect(result).not.toHaveProperty('email');
    expect(result).not.toHaveProperty('users');

    expect(userRepo.count).toHaveBeenNthCalledWith(1);
    expect(userRepo.count).toHaveBeenNthCalledWith(2, {
      where: { status: UserStatus.ACTIVE },
    });
    expect(sectionRepo.count).toHaveBeenCalledWith();
    expect(specialtyRepo.count).toHaveBeenCalledWith({
      where: { kind: SpecialtyKind.EXPLORATORY_WORKSHOP },
    });
    expect(specialtyRepo.count).toHaveBeenCalledWith({
      where: { kind: SpecialtyKind.TECHNICAL_SPECIALTY },
    });
  });

  it('preserves zero as a valid count', async () => {
    userRepo.count.mockResolvedValue(0);
    sectionRepo.count.mockResolvedValue(0);
    specialtyRepo.count.mockResolvedValue(0);

    const result = await service.getCampusSnapshot();
    expect(result.totalUsers).toBe(0);
    expect(result.totalSpecialties).toBe(0);
    expect(result.totalExploratoryWorkshops).toBe(0);
    expect(result.totalSections).toBe(0);
  });
});
