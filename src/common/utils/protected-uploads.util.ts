import { posix } from 'path';

/**
 * True si la ruta pública apunta a `/uploads/justifications`, tolerando
 * mayúsculas (FS de Windows), `%2F`, `\`, `//` y segmentos `..`.
 */
export function isJustificationUploadPath(rawPath: string): boolean {
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return true;
  }
  const normalized = posix.normalize(decoded.replace(/\\/g, '/')).toLowerCase();
  return (
    normalized === '/uploads/justifications' ||
    normalized.startsWith('/uploads/justifications/')
  );
}
