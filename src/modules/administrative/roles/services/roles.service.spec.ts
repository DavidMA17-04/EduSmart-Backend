import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { INSTITUTIONAL_ROLE_ADMIN } from '../../../../common/constants/institutional-roles.constant';
import { PROTECTED_ADMIN_PERMISSIONS } from '../../../../common/constants/protected-admin-permissions.constant';
import { PERMISSIONS } from '../../../../common/constants/permissions.constant';
import { RolesService } from './roles.service';

describe('RolesService guardrails', () => {
  const adminRole = {
    id: 1,
    name: INSTITUTIONAL_ROLE_ADMIN,
    permissions: [],
  };

  const teacherRole = {
    id: 2,
    name: 'Docente',
    permissions: [],
  };

  let repository: {
    findById: jest.Mock;
    setPermissions: jest.Mock;
    findByName: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    findAll: jest.Mock;
    deactivate: jest.Mock;
  };
  let permissionsService: {
    findByIdsOrFail: jest.Mock;
    findByCodesOrFail: jest.Mock;
    findAll: jest.Mock;
  };
  let service: RolesService;

  beforeEach(() => {
    repository = {
      findById: jest.fn(),
      setPermissions: jest.fn(async (_role, permissions) => ({
        ...adminRole,
        permissions,
      })),
      findByName: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      findAll: jest.fn(),
      deactivate: jest.fn(),
    };
    permissionsService = {
      findByIdsOrFail: jest.fn(),
      findByCodesOrFail: jest.fn(),
      findAll: jest.fn(),
    };
    service = new RolesService(repository as never, permissionsService as never);
  });

  it('rejects assigning Admin permissions without protected codes', async () => {
    repository.findById.mockResolvedValue(adminRole);
    permissionsService.findByIdsOrFail.mockResolvedValue([
      { id: 10, code: PERMISSIONS.ATTENDANCE_READ },
    ]);

    await expect(
      service.assignPermissions(1, { permissionIds: [10] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.setPermissions).not.toHaveBeenCalled();
  });

  it('allows Admin update when all protected permissions are present', async () => {
    repository.findById.mockResolvedValue(adminRole);
    const permissions = PROTECTED_ADMIN_PERMISSIONS.map((code, index) => ({
      id: index + 1,
      code,
    }));
    permissionsService.findByIdsOrFail.mockResolvedValue(permissions);

    await service.assignPermissions(
      1,
      { permissionIds: permissions.map((item) => item.id) },
    );

    expect(repository.setPermissions).toHaveBeenCalled();
  });

  it('resets Admin to all catalog permissions', async () => {
    repository.findById.mockResolvedValue(adminRole);
    const all = [
      ...PROTECTED_ADMIN_PERMISSIONS.map((code, index) => ({ id: index + 1, code })),
      { id: 99, code: PERMISSIONS.ATTENDANCE_READ },
    ];
    permissionsService.findAll.mockResolvedValue(all);

    await service.resetToDefaults(1);

    expect(permissionsService.findAll).toHaveBeenCalled();
    expect(repository.setPermissions).toHaveBeenCalledWith(adminRole, all);
  });

  it('rejects reset for roles without a default template', async () => {
    repository.findById.mockResolvedValue({ id: 9, name: 'Custom Role' });

    await expect(service.resetToDefaults(9)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not enforce protected set for non-admin roles', async () => {
    repository.findById.mockResolvedValue(teacherRole);
    permissionsService.findByIdsOrFail.mockResolvedValue([
      { id: 10, code: PERMISSIONS.ATTENDANCE_READ },
    ]);
    repository.setPermissions.mockResolvedValue({
      ...teacherRole,
      permissions: [{ id: 10, code: PERMISSIONS.ATTENDANCE_READ }],
    });

    await service.assignPermissions(2, { permissionIds: [10] });
    expect(repository.setPermissions).toHaveBeenCalled();
  });
});
