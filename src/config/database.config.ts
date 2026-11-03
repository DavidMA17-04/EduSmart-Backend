import { registerAs } from '@nestjs/config';

/**
 * SSL para bases en la nube (Aiven, etc.): `DB_SSL=true` cifra la conexión.
 * Con `DB_SSL_CA` (certificado PEM; los saltos de línea pueden ir escritos como \n)
 * además se verifica el certificado del servidor. Sin `DB_SSL` no se usa SSL.
 */
export function databaseSslFromEnv(env: NodeJS.ProcessEnv = process.env) {
  if (!/^(1|true|yes|required)$/i.test(String(env.DB_SSL ?? '').trim())) return undefined;
  const ca = env.DB_SSL_CA?.replace(/\\n/g, '\n').trim();
  return ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false };
}

export default registerAs('database', () => ({
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '3307', 10),
  username: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_DATABASE ?? 'EduSmart',
  synchronize: process.env.DB_SYNCHRONIZE ?? 'false',
  ssl: databaseSslFromEnv(),
}));
