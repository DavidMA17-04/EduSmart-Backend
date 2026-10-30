import { UserStatus } from '../../../../common/enums/user-status.enum';
import { UsersService } from './users.service';

describe('UsersService.findOwnProfile', () => {
  let repository: { findById: jest.Mock; save: jest.Mock };
  let auditLogService: { record: jest.Mock };
  let groupEnrollments: { createQueryBuilder: jest.Mock };
  let service: UsersService;
  let getOne: jest.Mock;

  const persisted = {
    id: 88,
    national_id: '118760543',
    nationalId: '118760543',
    name: 'Aaron',
    first_lastname: 'Solano',
    second_lastname: 'Cordero',
    email: 'solanoaaron853@gmail.com',
    phone: '88880000',
    status: UserStatus.ACTIVE,
    mustChangePassword: false,
    roles: [{ id: 3, name: 'Estudiante', status: 'ACTIVE' }],
    teacherProfile: null,
    createdAt: new Date('2026-10-27T00:00:00.000Z'),
    updatedAt: new Date('2026-10-27T00:00:00.000Z'),
  };

  beforeEach(() => {
    const stored = { ...persisted, roles: [...persisted.roles] };
    repository = {
      findById: jest.fn().mockImplementation(async () => stored),
      save: jest.fn(async (user) => {
        Object.assign(stored, user);
        return stored;
      }),
    };
    auditLogService = { record: jest.fn().mockResolvedValue(undefined) };
    getOne = jest.fn().mockResolvedValue(null);
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne,
    };
    groupEnrollments = { createQueryBuilder: jest.fn().mockReturnValue(qb) };

    service = new UsersService(
      repository as never,
      {} as never,
      auditLogService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      groupEnrollments as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  it('devuelve la ficha aunque no haya matrícula (usuario nuevo)', async () => {
    const view = await service.findOwnProfile(88);

    expect(view.email).toBe('solanoaaron853@gmail.com');
    expect(view.nationalId).toBe('118760543');
    expect(view.roles.map((role) => role.name)).toEqual(['Estudiante']);
    expect(view.enrollment).toBeNull();
  });

  it('adjunta la matrícula vigente cuando existe', async () => {
    getOne.mockResolvedValue({
      groupId: 12,
      academicPeriodId: 4,
      startsOn: '2026-02-01',
      status: 'ACTIVE',
      group: {
        name: 'A',
        section: { gradeLevel: 10 },
        specialty: { name: 'Programación' },
      },
      academicPeriod: { name: '2026' },
    });

    const view = await service.findOwnProfile(88);

    expect(view.enrollment).toEqual({
      groupId: 12,
      groupName: 'A',
      sectionLabel: '10-A',
      specialtyName: 'Programación',
      academicPeriodId: 4,
      academicPeriodName: '2026',
      startsOn: '2026-02-01',
      status: 'ACTIVE',
    });
  });

  it('PATCH teléfono propio no exige administrator.edit', async () => {
    const view = await service.updateProfile(88, { phone: '70001122' });

    expect(view.phone).toBe('70001122');
    expect(view.email).toBe('solanoaaron853@gmail.com');
    expect(repository.save).toHaveBeenCalled();
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_UPDATED', entityId: '88' }),
    );
  });
});
