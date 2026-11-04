import * as bcrypt from 'bcrypt';
import { UsersBootstrapService } from './users-bootstrap.service';

type Seeded = { password_hash: string; mustChangePassword: boolean };

function buildService(existingAdmin: Seeded | null = null) {
  const created: Seeded[] = [];
  const usersRepository = {
    findByEmail: jest.fn(async () => existingAdmin),
    create: jest.fn((value: Seeded) => value),
    save: jest.fn(async (value: Seeded) => {
      created.push(value);
      return { ...value, id: 1 };
    }),
    replaceRoles: jest.fn(),
  };
  const service = new UsersBootstrapService(
    usersRepository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const ensureAdminUser = (
    service as unknown as { ensureAdminUser: (id: number) => Promise<void> }
  ).ensureAdminUser.bind(service);
  return { created, ensureAdminUser, usersRepository };
}

describe('UsersBootstrapService · administrador inicial', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it('desarrollo: crea el administrador con la contraseña de ejemplo y sin forzar cambio', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ADMIN_PASSWORD;
    const { created, ensureAdminUser } = buildService();
    await ensureAdminUser(1);
    expect(created[0].mustChangePassword).toBe(false);
  });

  it('producción sin ADMIN_PASSWORD: no crea el administrador y explica qué falta', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ADMIN_PASSWORD;
    const { created, ensureAdminUser } = buildService();
    await expect(ensureAdminUser(1)).rejects.toThrow(/Defina ADMIN_PASSWORD/);
    expect(created).toHaveLength(0);
  });

  it('producción con la contraseña de ejemplo: la rechaza', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_PASSWORD = 'Admin1234';
    const { ensureAdminUser } = buildService();
    await expect(ensureAdminUser(1)).rejects.toThrow(/contraseña de ejemplo/);
  });

  it('producción con contraseña válida: lo crea y obliga a cambiarla en el primer ingreso', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_PASSWORD = 'UnaClaveLarga#2026';
    const { created, ensureAdminUser } = buildService();
    await ensureAdminUser(1);
    expect(created[0].mustChangePassword).toBe(true);
    expect(created[0].password_hash).not.toContain('UnaClaveLarga');
  });

  it('administrador existente con contraseña propia: no lo toca', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ADMIN_PASSWORD;
    const admin = {
      password_hash: await bcrypt.hash('OtraClaveReal#99', 4),
      mustChangePassword: false,
    };
    const { created, ensureAdminUser } = buildService(admin);
    await expect(ensureAdminUser(1)).resolves.toBeUndefined();
    expect(created).toHaveLength(0);
    expect(admin.mustChangePassword).toBe(false);
  });

  it('producción: el administrador sembrado por la migración con Admin1234 recibe ADMIN_PASSWORD y debe cambiarla', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_PASSWORD = 'UnaClaveLarga#2026';
    const admin = { password_hash: await bcrypt.hash('Admin1234', 4), mustChangePassword: false };
    const { created, ensureAdminUser } = buildService(admin);
    await ensureAdminUser(1);
    expect(created).toHaveLength(1);
    expect(await bcrypt.compare('UnaClaveLarga#2026', admin.password_hash)).toBe(true);
    expect(await bcrypt.compare('Admin1234', admin.password_hash)).toBe(false);
    expect(admin.mustChangePassword).toBe(true);
  });

  it('producción: administrador con Admin1234 y sin ADMIN_PASSWORD no deja arrancar', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ADMIN_PASSWORD;
    const admin = { password_hash: await bcrypt.hash('Admin1234', 4), mustChangePassword: false };
    const { ensureAdminUser } = buildService(admin);
    await expect(ensureAdminUser(1)).rejects.toThrow(/todavía usa la contraseña de ejemplo/);
  });

  it('desarrollo: el administrador con Admin1234 queda igual', async () => {
    process.env.NODE_ENV = 'development';
    const admin = { password_hash: await bcrypt.hash('Admin1234', 4), mustChangePassword: false };
    const { created, ensureAdminUser } = buildService(admin);
    await ensureAdminUser(1);
    expect(created).toHaveLength(0);
    expect(admin.mustChangePassword).toBe(false);
  });
});
