import { readFileSync } from 'fs';
import { join } from 'path';

describe('migration 031 restore operational role_permissions', () => {
  const sql = readFileSync(
    join(__dirname, '031_restore_operational_role_permissions.sql'),
    'utf8',
  );

  const studentGrant = sql.slice(
    sql.indexOf("r.`name` = 'Estudiante'"),
    sql.indexOf('DELETE rp'),
  );

  it('es idempotente y restaura la plantilla Estudiante sin students.view', () => {
    expect(sql).toContain('SET NAMES utf8mb4');
    expect(sql).toMatch(/NOT EXISTS/i);
    expect(studentGrant).toContain("'attendance.view_own'");
    expect(studentGrant).toContain("'attendance.justify'");
    expect(studentGrant).toContain("'schedules.view_own'");
    expect(studentGrant).toContain("'communications.view'");
    expect(studentGrant).toContain("'appeals.create'");
    expect(studentGrant).toContain("'disciplinary.view_own'");
    expect(studentGrant).not.toContain("'students.view'");
    expect(studentGrant).not.toContain("'attendance.view'");
  });

  it('revoca deriva de Estudiante (attendance.view y students.view) y conserva students.view en Docente', () => {
    expect(sql).toMatch(/r\.`name` = 'Estudiante'[\s\S]*'attendance\.view'[\s\S]*'students\.view'/);
    expect(sql).toContain("r.`name` = 'Docente'");
    expect(sql).toMatch(/r\.`name` = 'Docente'[\s\S]*'students\.view'/);
    expect(sql).not.toMatch(/id_roles\s*=\s*\d/);
    expect(sql).not.toMatch(/id_permissions\s*=\s*\d/);
  });
});
