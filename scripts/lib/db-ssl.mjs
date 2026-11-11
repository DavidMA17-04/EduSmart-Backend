/**
 * Opciones SSL para scripts (migrador, inspección Aiven), alineado con
 * src/config/database.config.ts salvo lectura de CA desde archivo.
 *
 * DB_SSL=true        obligatorio en Aiven
 * DB_SSL_CA_FILE     ruta al PEM (recomendado en Windows)
 * DB_SSL_CA          PEM en variable (saltos de línea como \\n)
 */
import fs from 'node:fs';

function readCaFromEnv(env) {
  const file = env.DB_SSL_CA_FILE?.trim();
  if (file) {
    const pem = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').trim();
    if (!pem.includes('BEGIN CERTIFICATE')) {
      throw new Error(`DB_SSL_CA_FILE no parece un PEM válido: ${file}`);
    }
    return pem;
  }
  const inline = env.DB_SSL_CA?.replace(/\\n/g, '\n').trim();
  if (inline && inline.includes('BEGIN CERTIFICATE')) return inline;
  return null;
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{ servername?: string }} [options] SNI / verificación de host (Aiven)
 */
export function dbSslFromEnv(env = process.env, options = {}) {
  if (!/^(1|true|yes|required)$/i.test(String(env.DB_SSL ?? '').trim())) return undefined;

  const ca = readCaFromEnv(env);
  if (!ca) {
    throw new Error(
      'DB_SSL=true requiere DB_SSL_CA_FILE (ruta al CA de Aiven) o DB_SSL_CA con el PEM.',
    );
  }

  const servername = (options.servername ?? env.DB_HOST)?.trim() || undefined;

  // VERIFY_CA (Aiven): cadena firmada por el CA del proyecto; hostname opcional.
  return {
    ca,
    rejectUnauthorized: true,
    minVersion: 'TLSv1.2',
    verifyIdentity: false,
    ...(servername ? { servername } : {}),
  };
}
