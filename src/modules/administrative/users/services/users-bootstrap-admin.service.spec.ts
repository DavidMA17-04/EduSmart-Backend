import * as bcrypt from 'bcrypt';
import { UsersBootstrapService } from './users-bootstrap.service';

type Seeded = {
  password_hash: string;
  mustChangePassword: boolean;
  id?: number;
  national_id?: string;
  email?: string;
  name?: string;
  first_lastname?: string;
  userRoles?: Array<{ roleId: number; role?: { name: string } }>;
};

const SEEDED_ADMIN_DEFAULTS: Pick<
  Seeded,
  'national_id' | 'email' | 'name' | 'first_lastname' | 'userRoles' | 'id'
> = {
  id: 1,
  national_id: '100000000',
  email: 'admin@ctphojancha.ed.cr',
  name: 'Administrador',
  first_lastname: 'CTP Hojancha',
  userRoles: [{ roleId: 1, role: { name: 'Administrador' } }],
};

type BuildOptions = {
  resolveByNationalId?: boolean;
  /** Simula findByEmail sin eager load de userRoles (comportamiento real del repositorio). */
  emailWithoutRelations?: boolean;
  findByIdReturnsNull?: boolean;
  findByIdWithoutAdminRole?: boolean;
};

function buildService(existingAdmin: Seeded | null = null, options: BuildOptions = {}) {
  const created: Seeded[] = [];
  if (existingAdmin) {
    Object.assign(existingAdmin, { ...SEEDED_ADMIN_DEFAULTS, ...existingAdmin });
  }
  const seededFull: Seeded | null = existingAdmin;

  const usersRepository = {
    findByEmail: jest.fn(async () => {
      if (options.resolveByNationalId || !seededFull) return null;
      if (options.emailWithoutRelations) {
        const { userRoles: _roles, ...withoutRoles } = seededFull;
        return withoutRoles;
      }
      return seededFull;
    }),
    findByNationalId: jest.fn(async (nationalId: string) => {
      if (!options.resolveByNationalId || !seededFull || nationalId !== '100000000') {
        return null;
      }
      return { id: seededFull.id ?? 1, national_id: nationalId };
    }),
    findById: jest.fn(async (id: number) => {
      if (options.findByIdReturnsNull) return null;
      if (!seededFull || id !== (seededFull.id ?? 1)) return null;
      if (options.findByIdWithoutAdminRole) {
        return {
          ...seededFull,
          userRoles: [{ roleId: 99, role: { name: 'Docente' } }],
        };
      }
      return seededFull;
    }),
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

  it('producción: ADMIN_EMAIL distinto pero cédula sembrada — reutiliza sin insertar ni cambiar roles', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_EMAIL = 'director@ctphojancha.ed.cr';
    process.env.ADMIN_PASSWORD = 'UnaClaveLarga#2026';
    const admin = { password_hash: await bcrypt.hash('Admin1234', 4), mustChangePassword: false };
    const { created, ensureAdminUser, usersRepository } = buildService(admin, {
      resolveByNationalId: true,
    });
    await ensureAdminUser(1);
    expect(usersRepository.create).not.toHaveBeenCalled();
    expect(usersRepository.replaceRoles).not.toHaveBeenCalled();
    expect(created).toHaveLength(1);
    expect(admin.mustChangePassword).toBe(true);
  });

  it('producción: cédula sembrada con nombre distinto — detiene el arranque', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_PASSWORD = 'UnaClaveLarga#2026';
    const admin = {
      password_hash: await bcrypt.hash('Admin1234', 4),
      mustChangePassword: false,
      name: 'Otro nombre',
    };
    const { ensureAdminUser, usersRepository } = buildService(admin, { resolveByNationalId: true });
    await expect(ensureAdminUser(1)).rejects.toThrow(/Inconsistencia/);
    expect(usersRepository.create).not.toHaveBeenCalled();
  });

  it('producción: cédula sembrada sin rol Administrador — detiene el arranque', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_PASSWORD = 'UnaClaveLarga#2026';
    const admin = {
      password_hash: await bcrypt.hash('Admin1234', 4),
      mustChangePassword: false,
      userRoles: [{ roleId: 99, role: { name: 'Docente' } }],
    };
    const { ensureAdminUser, usersRepository } = buildService(admin, { resolveByNationalId: true });
    await expect(ensureAdminUser(1)).rejects.toThrow(/no tiene asignado el rol Administrador/);
    expect(usersRepository.create).not.toHaveBeenCalled();
  });

  it('producción: findByEmail sin relaciones y findById con rol Administrador — no inserta duplicado', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_PASSWORD = 'UnaClaveLarga#2026';
    const admin = { password_hash: await bcrypt.hash('Admin1234', 4), mustChangePassword: false };
    const { created, ensureAdminUser, usersRepository } = buildService(admin, {
      emailWithoutRelations: true,
    });
    await ensureAdminUser(1);
    expect(usersRepository.findById).toHaveBeenCalledWith(1);
    expect(usersRepository.create).not.toHaveBeenCalled();
    expect(usersRepository.replaceRoles).not.toHaveBeenCalled();
    expect(created).toHaveLength(1);
  });

  it('producción: findByEmail sin relaciones y findById sin rol Administrador — inconsistencia', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_PASSWORD = 'UnaClaveLarga#2026';
    const admin = { password_hash: await bcrypt.hash('Admin1234', 4), mustChangePassword: false };
    const { ensureAdminUser, usersRepository } = buildService(admin, {
      emailWithoutRelations: true,
      findByIdWithoutAdminRole: true,
    });
    await expect(ensureAdminUser(1)).rejects.toThrow(/no tiene asignado el rol Administrador/);
    expect(usersRepository.create).not.toHaveBeenCalled();
  });

  it('producción: findById devuelve null — error explícito sin crear usuario', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_PASSWORD = 'UnaClaveLarga#2026';
    const admin = { password_hash: await bcrypt.hash('Admin1234', 4), mustChangePassword: false };
    const { ensureAdminUser, usersRepository } = buildService(admin, {
      emailWithoutRelations: true,
      findByIdReturnsNull: true,
    });
    await expect(ensureAdminUser(1)).rejects.toThrow(/No se pudo cargar el administrador sembrado/);
    expect(usersRepository.create).not.toHaveBeenCalled();
  });
});
