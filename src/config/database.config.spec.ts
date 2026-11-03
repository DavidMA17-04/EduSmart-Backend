import { databaseSslFromEnv } from './database.config';

describe('databaseSslFromEnv', () => {
  it('sin DB_SSL no usa SSL (base local o Docker)', () => {
    expect(databaseSslFromEnv({})).toBeUndefined();
    expect(databaseSslFromEnv({ DB_SSL: 'false' })).toBeUndefined();
  });

  it('DB_SSL=true cifra la conexión', () => {
    expect(databaseSslFromEnv({ DB_SSL: 'true' })).toEqual({ rejectUnauthorized: false });
  });

  it('con DB_SSL_CA verifica el certificado y acepta saltos de línea escritos como \\n', () => {
    expect(
      databaseSslFromEnv({ DB_SSL: 'true', DB_SSL_CA: '-----BEGIN-----\\nABC\\n-----END-----' }),
    ).toEqual({ ca: '-----BEGIN-----\nABC\n-----END-----', rejectUnauthorized: true });
  });
});
