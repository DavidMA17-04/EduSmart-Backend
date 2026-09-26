import { UserStatus } from '../../../../common/enums/user-status.enum';
import { CreateUserDto } from '../dto/create-user.dto';
import { UsersService } from './users.service';

describe('UsersService.create verification side effects', () => {
  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    replaceRoles: jest.Mock;
    findById: jest.Mock;
    findByNationalId: jest.Mock;
    findByEmail: jest.Mock;
  };
  let rolesRepository: { findById: jest.Mock };
  let auditLogService: { record: jest.Mock };
  let accountVerificationService: { issueAndSend: jest.Mock };
  let service: UsersService;

  const basePersisted = {
    id: 42,
    national_id: '109870543',
    nationalId: '109870543',
    name: 'María',
    first_lastname: 'Vargas',
    second_lastname: 'Soto',
    email: 'maria.pending@ctphojancha.ed.cr',
    phone: null,
    password_hash: 'hash',
    mustChangePassword: true,
    roles: [{ id: 1, name: 'Docente', status: 'ACTIVE' }],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    repository = {
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn(async (user) => ({ ...user, id: 42 })),
      replaceRoles: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn(),
      findByNationalId: jest.fn().mockResolvedValue(null),
      findByEmail: jest.fn().mockResolvedValue(null),
    };
    rolesRepository = {
      findById: jest.fn().mockResolvedValue({ id: 1, name: 'Docente', status: 'ACTIVE' }),
    };
    auditLogService = { record: jest.fn().mockResolvedValue(undefined) };
    accountVerificationService = {
      issueAndSend: jest.fn().mockResolvedValue(undefined),
    };

    service = new UsersService(
      repository as never,
      rolesRepository as never,
      auditLogService as never,
      accountVerificationService as never,
      {} as never,
    );
  });

  it('create PENDING issues verification code (PBI-16)', async () => {
    repository.findById.mockResolvedValue({
      ...basePersisted,
      status: UserStatus.PENDING,
    });

    const dto: CreateUserDto = {
      nationalId: '109870543',
      name: 'María',
      first_lastname: 'Vargas',
      second_lastname: 'Soto',
      email: 'maria.pending@ctphojancha.ed.cr',
      status: UserStatus.PENDING,
      roleIds: [1],
      password: 'Temporal1!',
    };

    const view = await service.create(dto, 7);

    expect(view.status).toBe(UserStatus.PENDING);
    expect(accountVerificationService.issueAndSend).toHaveBeenCalledWith(42, 7);
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USER_CREATED',
        entityId: '42',
      }),
    );
  });

  it('create ACTIVE does not issue verification', async () => {
    repository.findById.mockResolvedValue({
      ...basePersisted,
      status: UserStatus.ACTIVE,
      email: 'maria.active@ctphojancha.ed.cr',
    });

    const dto: CreateUserDto = {
      nationalId: '109870543',
      name: 'María',
      first_lastname: 'Vargas',
      email: 'maria.active@ctphojancha.ed.cr',
      status: UserStatus.ACTIVE,
      roleIds: [1],
      password: 'Temporal1!',
    };

    const view = await service.create(dto, 7);

    expect(view.status).toBe(UserStatus.ACTIVE);
    expect(accountVerificationService.issueAndSend).not.toHaveBeenCalled();
  });
});
