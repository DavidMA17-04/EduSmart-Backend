/**
 * Opciones SSL para los scripts (migrador y semillas), con el mismo criterio
 * que el backend (src/config/database.config.ts):
 *   DB_SSL=true        cifra la conexión (requerido por Aiven y otras bases en la nube)
 *   DB_SSL_CA=<PEM>    además verifica el certificado del servidor (recomendado)
 * Sin DB_SSL (base local o Docker) no se usa SSL.
 */
export function dbSslFromEnv(env = process.env) {
  if (!/^(1|true|yes|required)$/i.test(String(env.DB_SSL ?? '').trim())) return undefined;
  const ca = env.DB_SSL_CA?.replace(/\\n/g, '\n').trim();
  return ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false };
}
