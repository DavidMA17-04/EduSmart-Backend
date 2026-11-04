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

  it('restablecer Estudiante aplica view_own y no añade students.view', async () => {
    const studentRole = { id: 3, name: 'Estudiante', permissions: [] };
    repository.findById.mockResolvedValue(studentRole);
    permissionsService.findByCodesOrFail.mockImplementation(async (codes: string[]) =>
      codes.map((code, index) => ({ id: index + 1, code })),
    );
    repository.setPermissions.mockImplementation(async (_role, permissions) => ({
      ...studentRole,
      permissions,
    }));

    const result = await service.resetToDefaults(3);
    const codes = result.permissions.map((item: { code: string }) => item.code);

    expect(codes).toEqual(
      expect.arrayContaining([
        PERMISSIONS.ATTENDANCE_VIEW_OWN,
        PERMISSIONS.ATTENDANCE_JUSTIFY,
        PERMISSIONS.SCHEDULES_VIEW_OWN,
        PERMISSIONS.COMMUNICATIONS_READ,
        PERMISSIONS.APPEALS_CREATE,
        PERMISSIONS.DISCIPLINARY_VIEW_OWN,
      ]),
    );
    expect(codes).not.toContain(PERMISSIONS.STUDENTS_READ);
    expect(codes).not.toContain(PERMISSIONS.ATTENDANCE_READ);
  });

  it('restablecer Docente conserva students.view', async () => {
    repository.findById.mockResolvedValue(teacherRole);
    permissionsService.findByCodesOrFail.mockImplementation(async (codes: string[]) =>
      codes.map((code, index) => ({ id: index + 1, code })),
    );
    repository.setPermissions.mockImplementation(async (_role, permissions) => ({
      ...teacherRole,
      permissions,
    }));

    const result = await service.resetToDefaults(2);
    const codes = result.permissions.map((item: { code: string }) => item.code);

    expect(codes).toContain(PERMISSIONS.STUDENTS_READ);
    expect(codes).toContain(PERMISSIONS.ATTENDANCE_READ);
    expect(codes).toContain(PERMISSIONS.SCHEDULES_VIEW_OWN);
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
