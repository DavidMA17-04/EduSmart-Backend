import { readFileSync } from 'fs';
import { join } from 'path';

describe('disciplinary module migrations (static)', () => {
  const migrationsDir = join(__dirname, '../../../database/migrations');
  const moduleSql = readFileSync(join(migrationsDir, '026_disciplinary_module.sql'), 'utf8');
  const rolesSql = readFileSync(join(migrationsDir, '027_disciplinary_roles_permissions.sql'), 'utf8');

  it('026 es idempotente, en utf8mb4, y relaciona expedientes con users, groups, periods y subjects', () => {
    expect(moduleSql).toContain('SET NAMES utf8mb4');
    expect(moduleSql).toContain('CREATE TABLE IF NOT EXISTS `disciplinary_cases`');
    expect(moduleSql).toContain('CREATE TABLE IF NOT EXISTS `disciplinary_case_sequences`');
    expect(moduleSql).toContain('CREATE TABLE IF NOT EXISTS `disciplinary_evidences`');
    expect(moduleSql).toContain('CREATE TABLE IF NOT EXISTS `disciplinary_case_events`');
    expect(moduleSql).toContain('CREATE TABLE IF NOT EXISTS `disciplinary_communications`');
    expect(moduleSql).toContain('CREATE TABLE IF NOT EXISTS `disciplinary_notifications`');
    expect(moduleSql).toContain('CREATE TABLE IF NOT EXISTS `disciplinary_defenses`');
    expect(moduleSql).toContain('CREATE TABLE IF NOT EXISTS `disciplinary_appeals`');
    expect(moduleSql).toContain('CREATE TABLE IF NOT EXISTS `disciplinary_precautionary_measures`');
    expect(moduleSql).toContain('CREATE TABLE IF NOT EXISTS `disciplinary_follow_ups`');
    expect(moduleSql).toContain('CREATE TABLE IF NOT EXISTS `non_working_days`');
    expect(moduleSql).toContain('CREATE TABLE IF NOT EXISTS `disciplinary_settings`');
    expect(moduleSql).toContain('REFERENCES `users` (`id_users`)');
    expect(moduleSql).toContain('REFERENCES `groups` (`id_groups`)');
    expect(moduleSql).toContain('REFERENCES `academic_periods` (`id_academic_periods`)');
    expect(moduleSql).toContain('REFERENCES `subjects` (`id_subjects`)');
    expect(moduleSql).not.toMatch(/DROP TABLE/i);
  });

  it('027 conserva el ENUM de action y agrega las acciones nuevas', () => {
    for (const action of [
      'VIEW',
      'CREATE',
      'EDIT',
      'DELETE',
      'EXPORT',
      'CONFIGURE',
      'VIEW_OWN',
      'JUSTIFY',
      'REVIEW',
      'RESOLVE',
      'APPEAL',
      'PRECAUTIONARY',
      'RESPOND',
    ]) {
      expect(rolesSql).toContain(`'${action}'`);
    }
    expect(rolesSql).toContain('SET NAMES utf8mb4');
    expect(rolesSql).toContain('WHERE NOT EXISTS');
  });

  it('027 crea los roles, asigna la matriz y revoca disciplinary.view a Docente', () => {
    expect(rolesSql).toContain("'Orientador'");
    expect(rolesSql).toContain("'Director'");
    expect(rolesSql).toContain("'Encargado'");
    expect(rolesSql).toContain("'Padre de familia'");
    expect(rolesSql).toContain("'disciplinary.view_own'");
    expect(rolesSql).toContain("'disciplinary.review'");
    expect(rolesSql).toContain("'disciplinary.resolve'");
    expect(rolesSql).toContain("'disciplinary.appeal'");
    expect(rolesSql).toContain("'disciplinary.precautionary'");
    expect(rolesSql).toContain("'disciplinary.respond'");
    expect(rolesSql).toMatch(/r\.`name` = 'Docente'[\s\S]*p\.`code` = 'disciplinary\.view'/);
    expect(rolesSql).not.toMatch(/id_roles\s*=\s*\d/);
  });
});
