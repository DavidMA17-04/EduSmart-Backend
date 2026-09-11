import { readFileSync } from 'fs';
import { join } from 'path';

describe('Phase 1A.1 attendance migrations (static)', () => {
  const migrationsDir = join(__dirname, '../../../database/migrations');

  it('16. migration 010 uses ON DELETE RESTRICT for session FK (not CASCADE)', () => {
    const sql = readFileSync(
      join(migrationsDir, '010_attendance_records.sql'),
      'utf8',
    );
    expect(sql).toMatch(
      /FK_attendance_sessions[\s\S]*ON DELETE RESTRICT/,
    );
    expect(sql).not.toMatch(
      /FK_attendance_sessions[\s\S]*ON DELETE CASCADE/,
    );
  });

  it('17-19. migration 011 grants Docente view/create/edit idempotently', () => {
    const sql = readFileSync(
      join(migrationsDir, '011_attendance_teacher_permissions.sql'),
      'utf8',
    );
    expect(sql).toContain("r.`name` = 'Docente'");
    expect(sql).toContain("'attendance.view'");
    expect(sql).toContain("'attendance.create'");
    expect(sql).toContain("'attendance.edit'");
    expect(sql).toContain('NOT EXISTS');
    expect(sql).not.toContain("'attendance.delete'");
    expect(sql).not.toContain("'attendance.export'");
    expect(sql).not.toContain("'attendance.configure'");
    expect(sql).not.toMatch(/id_roles\s*=\s*\d/);
  });
});
