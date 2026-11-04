import { BadRequestException, NotFoundException } from '@nestjs/common';
import { extname, resolve, sep } from 'path';

export const EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;
export const EVIDENCE_MAX_FILES = 5;

const MIME_BY_EXT: Record<string, readonly string[]> = {
  '.pdf': ['application/pdf'],
  '.jpg': ['image/jpeg', 'image/jpg'],
  '.jpeg': ['image/jpeg', 'image/jpg'],
  '.png': ['image/png'],
};

export function assertEvidenceFile(file: {
  originalname: string;
  mimetype: string;
  size: number;
}): string {
  const ext = extname(file.originalname).toLowerCase();
  const allowed = MIME_BY_EXT[ext];
  if (!allowed || !allowed.includes(file.mimetype.toLowerCase())) {
    throw new BadRequestException({
      code: 'EVIDENCE_FORMAT',
      message: 'Solo se permiten archivos PDF, JPG o PNG',
    });
  }
  if (file.size <= 0 || file.size > EVIDENCE_MAX_BYTES) {
    throw new BadRequestException({
      code: 'EVIDENCE_TOO_LARGE',
      message: 'La evidencia no puede superar 10 MB',
    });
  }
  return ext;
}

export function assertEvidenceCount(count: number): void {
  if (count >= EVIDENCE_MAX_FILES) {
    throw new BadRequestException({
      code: 'EVIDENCE_LIMIT',
      message: 'Un expediente admite como máximo 5 evidencias',
    });
  }
}

/** Resuelve la ruta guardada y rechaza cualquier salida de `storage/disciplinary`. */
export function evidenceAbsolutePath(storageRoot: string, storagePath: string): string {
  if (!/^\d+\/[A-Za-z0-9._-]+$/.test(storagePath)) {
    throw new NotFoundException({ code: 'EVIDENCE_NOT_FOUND', message: 'La evidencia no existe' });
  }
  const root = resolve(storageRoot);
  const absolute = resolve(root, storagePath);
  if (absolute !== root && !absolute.startsWith(root + sep)) {
    throw new NotFoundException({ code: 'EVIDENCE_NOT_FOUND', message: 'La evidencia no existe' });
  }
  return absolute;
}
