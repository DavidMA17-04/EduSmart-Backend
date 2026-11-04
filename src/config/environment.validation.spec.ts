import 'reflect-metadata';
import {
  adminPasswordProblem,
  productionConfigProblems,
  validateEnvironment,
} from './environment.validation';

const base = {
  DB_HOST: 'localhost',
  DB_PORT: '3306',
  DB_USERNAME: 'root',
  DB_PASSWORD: 'x',
  DB_DATABASE: 'edusmart',
  JWT_EXPIRATION: '8h',
  JWT_REFRESH_EXPIRATION: '7d',
};
const strong = {
  JWT_SECRET: 'a3f9c1e07b2d4c88e1f05a6b9d2c7e4f',
  JWT_REFRESH_SECRET: 'f1e2d3c4b5a69788796a5b4c3d2e1f00',
  CORS_ORIGIN: 'https://edusmart.vercel.app',
};

describe('validateEnvironment', () => {
  it('desarrollo: sigue aceptando los valores de ejemplo', () => {
    expect(() =>
      validateEnvironment({ ...base, JWT_SECRET: 'changeme', JWT_REFRESH_SECRET: 'changeme' }),
    ).not.toThrow();
  });

  it('producción: rechaza "changeme" y explica cómo corregirlo', () => {
    expect(() =>
      validateEnvironment({
        ...base,
        NODE_ENV: 'production',
        JWT_SECRET: 'changeme',
        JWT_REFRESH_SECRET: 'changeme',
      }),
    ).toThrow(/JWT_SECRET usa un valor de ejemplo/);
  });

  it('producción: arranca con secretos largos, distintos y sin valores de ejemplo', () => {
    expect(() => validateEnvironment({ ...base, ...strong, NODE_ENV: 'production' })).not.toThrow();
  });
});

describe('productionConfigProblems', () => {
  it('exige 32 caracteres y secretos distintos', () => {
    const problems = productionConfigProblems({
      JWT_SECRET: 'corto-pero-no-ejemplo',
      JWT_REFRESH_SECRET: 'corto-pero-no-ejemplo',
    });
    expect(problems).toEqual(
      expect.arrayContaining([
        'JWT_SECRET debe tener al menos 32 caracteres.',
        'JWT_SECRET y JWT_REFRESH_SECRET deben ser distintos.',
      ]),
    );
  });

  it('rechaza la contraseña de ejemplo del administrador si se define', () => {
    expect(productionConfigProblems({ ...strong, ADMIN_PASSWORD: 'Admin1234' })).toEqual([
      'ADMIN_PASSWORD no puede ser la contraseña de ejemplo (Admin1234).',
    ]);
    expect(productionConfigProblems({ ...strong })).toEqual([]);
  });

  it('valida la contraseña del administrador', () => {
    expect(adminPasswordProblem('Corta1')).toMatch(/12 caracteres/);
    expect(adminPasswordProblem('UnaClaveLarga#2026')).toBeNull();
  });
});

describe('CORS en producción', () => {
  it('exige el dominio del frontend', () => {
    expect(productionConfigProblems({ ...strong, CORS_ORIGIN: '' })).toEqual([
      expect.stringContaining('CORS_ORIGIN debe indicar el dominio del frontend'),
    ]);
  });

  it('no acepta "*"', () => {
    expect(productionConfigProblems({ ...strong, CORS_ORIGIN: 'https://a.app, *' })).toHaveLength(1);
  });

  it('acepta una lista de dominios', () => {
    expect(
      productionConfigProblems({ ...strong, CORS_ORIGIN: 'https://a.vercel.app,https://b.app' }),
    ).toEqual([]);
  });
});
