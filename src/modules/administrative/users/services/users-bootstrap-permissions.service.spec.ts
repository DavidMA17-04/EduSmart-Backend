import { PERMISSIONS } from '../../../../common/constants/permissions.constant';
import { UsersBootstrapService } from './users-bootstrap.service';

describe('UsersBootstrapService — catálogo existente', () => {
  it('completa códigos faltantes aunque el catálogo ya tenga más de 66 filas', async () => {
    const entries = Array.from({ length: 70 }, (_, id) => ({ id, code: `custom.${id}` }));
    const permissions = {
      findAll: jest.fn(async () => entries), create: jest.fn(x => x),
      save: jest.fn(async x => { const item = { id: entries.length + 1, ...x }; entries.push(item); return item; }),
    };
    const service = new UsersBootstrapService({} as any, {} as any, permissions as any, {} as any, {} as any, {} as any);
    await (service as any).ensurePermissions();
    for (const code of Object.values(PERMISSIONS)) expect(entries.some(p => p.code === code)).toBe(true);
    expect(entries.some(p => p.code === 'students.publish')).toBe(false);
    const saved = permissions.save.mock.calls.length;
    await (service as any).ensurePermissions();
    expect(permissions.save).toHaveBeenCalledTimes(saved);
    expect(entries.filter(p => p.code.startsWith('custom.'))).toHaveLength(70);
  });
});
