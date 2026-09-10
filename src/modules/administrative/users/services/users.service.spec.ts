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
  let service: UsersService;

  beforeEach(() => {
    const persisted = {
      id: 42,
      national_id: '109870543',
      nationalId: '109870543',
      name: 'María',
      first_lastname: 'Vargas',
      second_lastname: 'Soto',
      email: 'maria.pending@ctphojancha.ed.cr',
      phone: null,
      status: UserStatus.PENDING,
      password_hash: 'hash',
      mustChangePassword: true,
      roles: [{ id: 1, name: 'Docente', status: 'ACTIVE' }],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    repository = {
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn(async (user) => ({ ...user, id: 42 })),
      replaceRoles: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn().mockResolvedValue(persisted),
      findByNationalId: jest.fn().mockResolvedValue(null),
      findByEmail: jest.fn().mockResolvedValue(null),
    };
    rolesRepository = {
      findById: jest.fn().mockResolvedValue({ id: 1, name: 'Docente', status: 'ACTIVE' }),
    };
    auditLogService = { record: jest.fn().mockResolvedValue(undefined) };

    service = new UsersService(
      repository as never,
      rolesRepository as never,
      auditLogService as never,
      {} as never,
    );
  });

  it('create PENDING does not generate code or send verification mail', async () => {
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
    expect(repository.save).toHaveBeenCalled();
    expect(repository.replaceRoles).toHaveBeenCalledWith(42, expect.any(Array));
    expect(auditLogService.record).toHaveBeenCalledTimes(1);
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USER_CREATED',
        entityId: '42',
      }),
    );
    expect(auditLogService.record).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_VERIFICATION_SENT' }),
    );
    expect(auditLogService.record).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_VERIFICATION_RESENT' }),
    );
    expect(auditLogService.record).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_VERIFICATION_SEND_FAILED' }),
    );
  });
});
