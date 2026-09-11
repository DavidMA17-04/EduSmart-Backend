import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from '@jest/globals';

describe('migration 017 static audit (F1 schedule occurrence anchor)', () => {
  const file = path.join(
    __dirname,
    '../../../database/migrations/017_attendance_session_schedule_anchor.sql',
  );
  const sql = fs.readFileSync(file, 'utf8');
  const executable = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

  it('ALTER only attendance_sessions; nullable id_schedule_entries', () => {
    expect(executable).toMatch(/ALTER\s+TABLE\s+`attendance_sessions`/i);
    expect(executable).toMatch(
      /ADD\s+COLUMN\s+`id_schedule_entries`\s+INT\s+NULL/i,
    );
    expect(executable).not.toMatch(/ALTER\s+TABLE\s+`schedule_entries`/i);
    expect(executable).not.toMatch(/ALTER\s+TABLE\s+`attendance_records`/i);
  });

  it('FK → schedule_entries ON DELETE RESTRICT; UNIQUE anchor + session_date', () => {
    expect(executable).toMatch(
      /CONSTRAINT\s+`FK_attendance_sessions_schedule_entries`/i,
    );
    expect(executable).toMatch(
      /FOREIGN\s+KEY\s+\(`id_schedule_entries`\)\s+REFERENCES\s+`schedule_entries`\s+\(`id_schedule_entries`\)/i,
    );
    expect(executable).toMatch(/ON\s+DELETE\s+RESTRICT/i);
    expect(executable).toMatch(
      /UNIQUE\s+KEY\s+`UQ_attendance_sessions_schedule_anchor_date`\s*\(\s*`id_schedule_entries`\s*,\s*`session_date`\s*\)/i,
    );
  });

  it('no backfill / DROP / permissions / hardcoded IDs / schedule mutation', () => {
    expect(executable).not.toMatch(/UPDATE\s+`attendance_sessions`/i);
    expect(executable).not.toMatch(/\bINSERT\b/i);
    expect(executable).not.toMatch(/\bDROP\b/i);
    expect(executable).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(executable).toMatch(/ON\s+DELETE\s+RESTRICT/i);
    expect(executable).not.toMatch(/role_permissions|permissions/i);
    expect(sql).not.toMatch(/id_schedule_entries\s*=\s*\d/);
    expect(executable).not.toMatch(/MODIFY\s+COLUMN/i);
  });

  it('UNIQUE leftmost covers FK index need; no redundant KEY on same column alone', () => {
    expect(executable).toMatch(
      /UQ_attendance_sessions_schedule_anchor_date/,
    );
    expect(executable).not.toMatch(
      /KEY\s+`IDX_attendance_sessions_schedule_entries`/i,
    );
  });
});
