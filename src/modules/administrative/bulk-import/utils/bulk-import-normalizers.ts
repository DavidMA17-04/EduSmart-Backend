import { UserStatus } from '../../../../common/enums/user-status.enum';
import { UserRoleEnum } from '../dto/bulk-import.dto';

const ROLE_ALIASES: Record<string, UserRoleEnum> = {
  estudiante: UserRoleEnum.ESTUDIANTE,
  student: UserRoleEnum.ESTUDIANTE,
  docente: UserRoleEnum.DOCENTE,
  profesor: UserRoleEnum.DOCENTE,
  teacher: UserRoleEnum.DOCENTE,
  administrativo: UserRoleEnum.ADMINISTRATIVO,
  administrador: UserRoleEnum.ADMINISTRATIVO,
  admin: UserRoleEnum.ADMINISTRATIVO,
  directivo: UserRoleEnum.DIRECTIVO,
  director: UserRoleEnum.DIRECTIVO,
};

const USER_STATUS_ALIASES: Record<string, UserStatus> = {
  activo: UserStatus.ACTIVE,
  active: UserStatus.ACTIVE,
  inactivo: UserStatus.INACTIVE,
  inactive: UserStatus.INACTIVE,
  bloqueado: UserStatus.BLOCKED,
  blocked: UserStatus.BLOCKED,
  /** Compatibilidad con plantillas Excel antiguas */
  desactivado: UserStatus.BLOCKED,
};

export function normalizeTextKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function normalizeRole(raw: string): UserRoleEnum | null {
  const key = normalizeTextKey(raw);
  if (!key) {
    return UserRoleEnum.ESTUDIANTE;
  }
  return ROLE_ALIASES[key] ?? null;
}

export type UserStatusParseResult =
  | { ok: true; value: UserStatus }
  | { ok: false; error: string };

export function parseUserStatus(raw: string): UserStatusParseResult {
  const key = normalizeTextKey(raw);
  if (!key) {
    return { ok: true, value: UserStatus.ACTIVE };
  }

  const status = USER_STATUS_ALIASES[key];
  if (!status) {
    return {
      ok: false,
      error: `Estado '${raw.trim()}' no válido. Valores permitidos: Activo, Inactivo, Bloqueado.`,
    };
  }

  return { ok: true, value: status };
}

export function pickFirstValue(
  row: Record<string, string>,
  keys: string[],
): string {
  for (const key of keys) {
    const value = row[key];
    if (value) {
      return value;
    }
  }
  return '';
}

const BULK_IMPORT_NATIONAL_ID_PATTERN = /^[0-9]{9,30}$/;

export const BULK_IMPORT_NATIONAL_ID_ERROR =
  'La cédula debe contener entre 9 y 30 dígitos.';

export function digitsOnlyNationalId(value: string): string {
  return value.replace(/-/g, '').trim();
}

export function isValidBulkImportNationalId(value: string): boolean {
  return BULK_IMPORT_NATIONAL_ID_PATTERN.test(digitsOnlyNationalId(value));
}
