import { PermissionAction } from '../../../../common/enums/permission-action.enum';
import { PermissionModule } from '../../../../common/enums/permission-module.enum';
import { PermissionsService } from './permissions.service';

describe('PermissionAction / buildCode (D1.1 VIEW_OWN)', () => {
  it('1. PermissionAction contiene VIEW_OWN', () => {
    expect(PermissionAction.VIEW_OWN).toBe('VIEW_OWN');
    expect(Object.values(PermissionAction)).toContain('VIEW_OWN');
  });

  it('2. buildCode(SCHEDULES, VIEW_OWN) → schedules.view_own', async () => {
    const save = jest.fn(async (entity: unknown) => entity);
    const create = jest.fn((data: unknown) => data);
    const repository = {
      findByCode: jest.fn().mockResolvedValue(null),
      findByModuleAndAction: jest.fn().mockResolvedValue(null),
      create,
      save,
    };
    const service = new PermissionsService(repository as never);

    await service.create({
      module: PermissionModule.SCHEDULES,
      action: PermissionAction.VIEW_OWN,
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'schedules.view_own',
        module: PermissionModule.SCHEDULES,
        action: PermissionAction.VIEW_OWN,
      }),
    );
  });

  it('3–5. SCHEDULES+VIEW y SCHEDULES+VIEW_OWN son pares distintos; uniqueness sigue', async () => {
    expect(
      `${PermissionModule.SCHEDULES}.${PermissionAction.VIEW}`,
    ).not.toBe(`${PermissionModule.SCHEDULES}.${PermissionAction.VIEW_OWN}`);

    const findByModuleAndAction = jest
      .fn()
      .mockResolvedValueOnce({ id: 1, code: 'schedules.view' })
      .mockResolvedValueOnce(null);

    const service = new PermissionsService({
      findByCode: jest.fn().mockResolvedValue(null),
      findByModuleAndAction,
      create: jest.fn((d: unknown) => d),
      save: jest.fn(async (e: unknown) => e),
    } as never);

    await expect(
      service.create({
        module: PermissionModule.SCHEDULES,
        action: PermissionAction.VIEW,
        code: 'schedules.view.dup',
      }),
    ).rejects.toThrow(/already exists/i);

    await expect(
      service.create({
        module: PermissionModule.SCHEDULES,
        action: PermissionAction.VIEW_OWN,
      }),
    ).resolves.toMatchObject({
      code: 'schedules.view_own',
      action: PermissionAction.VIEW_OWN,
    });
  });
});
