import {
  DEFAULT_ROLE_PERMISSIONS,
  getDefaultPermissionTemplate,
} from './default-role-permissions.constant';
import {
  INSTITUTIONAL_ROLE_STUDENT,
  INSTITUTIONAL_ROLE_TEACHER,
} from './institutional-roles.constant';
import { PERMISSIONS } from './permissions.constant';

const STUDENT_TEMPLATE = [
  PERMISSIONS.ATTENDANCE_VIEW_OWN,
  PERMISSIONS.ATTENDANCE_JUSTIFY,
  PERMISSIONS.SCHEDULES_VIEW_OWN,
  PERMISSIONS.COMMUNICATIONS_READ,
  PERMISSIONS.APPEALS_CREATE,
  PERMISSIONS.DISCIPLINARY_VIEW_OWN,
];

describe('DEFAULT_ROLE_PERMISSIONS', () => {
  it('Estudiante tiene view_own/justify y no students.view ni attendance.view', () => {
    const student = DEFAULT_ROLE_PERMISSIONS[INSTITUTIONAL_ROLE_STUDENT];
    expect(student).toEqual(STUDENT_TEMPLATE);
    expect(student).not.toContain(PERMISSIONS.STUDENTS_READ);
    expect(student).not.toContain(PERMISSIONS.ATTENDANCE_READ);
    expect(getDefaultPermissionTemplate(INSTITUTIONAL_ROLE_STUDENT)).toEqual(STUDENT_TEMPLATE);
  });

  it('Docente conserva students.view junto a asistencia y horario', () => {
    const teacher = DEFAULT_ROLE_PERMISSIONS[INSTITUTIONAL_ROLE_TEACHER];
    expect(Array.isArray(teacher)).toBe(true);
    expect(teacher).toContain(PERMISSIONS.STUDENTS_READ);
    expect(teacher).toContain(PERMISSIONS.ATTENDANCE_READ);
    expect(teacher).toContain(PERMISSIONS.SCHEDULES_VIEW_OWN);
    expect(teacher).not.toContain(PERMISSIONS.ACADEMIC_STRUCTURE_CONFIGURE);
    expect(teacher).not.toContain(PERMISSIONS.PERIODS_CREATE);
    expect(teacher).not.toContain(PERMISSIONS.PERIODS_EDIT);
  });
  it.each([
    ['Docente', ['communications.view','communications.create','communications.publish']],
    ['Director', ['communications.view','communications.create','communications.publish','communications.manage','communications.stats']],
    ['Encargado', ['communications.view']], ['Padre de familia', ['communications.view']], ['Orientador', []],
  ])('restablecer %s conserva la matriz de comunicados', (role, expected) => {
    const template = getDefaultPermissionTemplate(role as string) as readonly string[];
    expect(template.filter(code => code.startsWith('communications.')).sort()).toEqual([...(expected as string[])].sort());
  });

});
