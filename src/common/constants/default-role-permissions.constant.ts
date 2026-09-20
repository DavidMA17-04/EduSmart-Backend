import {
  INSTITUTIONAL_ROLE_ADMIN,
  INSTITUTIONAL_ROLE_STUDENT,
  INSTITUTIONAL_ROLE_TEACHER,
} from './institutional-roles.constant';
import { PERMISSIONS } from './permissions.constant';

/** Sentinel: asignar todos los permisos del catálogo al restablecer. */
export const DEFAULT_ROLE_PERMISSIONS_ALL = 'ALL' as const;

export type DefaultRolePermissionTemplate =
  | typeof DEFAULT_ROLE_PERMISSIONS_ALL
  | readonly string[];

/**
 * Plantillas de permisos de fábrica por rol institucional (PO-02-04).
 * Admin = catálogo completo; Docente/Estudiante = baselines operativos.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, DefaultRolePermissionTemplate> = {
  [INSTITUTIONAL_ROLE_ADMIN]: DEFAULT_ROLE_PERMISSIONS_ALL,
  [INSTITUTIONAL_ROLE_TEACHER]: [
    PERMISSIONS.ATTENDANCE_REGISTER,
    PERMISSIONS.ATTENDANCE_READ,
    PERMISSIONS.ATTENDANCE_EDIT,
    PERMISSIONS.ATTENDANCE_JUSTIFY,
    PERMISSIONS.STUDENTS_READ,
    PERMISSIONS.SCHEDULES_VIEW_OWN,
    PERMISSIONS.COMMUNICATIONS_READ,
    PERMISSIONS.DISCIPLINARY_CREATE,
    PERMISSIONS.DISCIPLINARY_READ,
    PERMISSIONS.ACADEMIC_STRUCTURE_VIEW,
    PERMISSIONS.PERIODS_VIEW,
    PERMISSIONS.SECTIONS_VIEW,
    PERMISSIONS.SPECIALTIES_VIEW,
  ],
  [INSTITUTIONAL_ROLE_STUDENT]: [
    PERMISSIONS.ATTENDANCE_READ,
    PERMISSIONS.SCHEDULES_VIEW_OWN,
    PERMISSIONS.COMMUNICATIONS_READ,
    PERMISSIONS.APPEALS_CREATE,
  ],
};

export function getDefaultPermissionTemplate(
  roleName: string,
): DefaultRolePermissionTemplate | null {
  return DEFAULT_ROLE_PERMISSIONS[roleName] ?? null;
}
