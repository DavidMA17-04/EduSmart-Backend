/**
 * Apply SQL migrations 008–018 to local MySQL.
 * Also archives legacy UUID stub tables that block CREATE TABLE IF NOT EXISTS.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const migrationsDir = path.join(__dirname, '..', 'src', 'database', 'migrations');

const FILES = [
  '008_attendance_phase0_foundations.sql',
  '009_attendance_sessions.sql',
  '010_attendance_records.sql',
  '011_attendance_teacher_permissions.sql',
  '012_schedule_time_slots.sql',
  '013_schedule_entries.sql',
  '014_schedule_permissions.sql',
  '015_schedule_view_own_permission.sql',
  '016_schedule_student_view_own_permission.sql',
  '017_attendance_session_schedule_anchor.sql',
  '018_attendance_history_and_session_tokens.sql',
  '018_attendance_justifications.sql',
  '019_attendance_status_justified.sql',
  '019_attendance_guardian_bridge.sql',
];

async function archiveLegacyAttendanceStubs(conn) {
  const [cols] = await conn.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance' AND COLUMN_NAME = 'id'`,
  );
  if (cols.length === 0) {
    console.log('No legacy attendance stub to archive.');
    return;
  }

  const [idCols] = await conn.query(
    `SELECT DATA_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance' AND COLUMN_NAME = 'id'`,
  );
  const dataType = idCols[0]?.DATA_TYPE;
  if (dataType !== 'varchar' && dataType !== 'char') {
    console.log('attendance table already looks like Phase 1A schema; skipping archive.');
    return;
  }

  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  for (const table of ['absence_justifications', 'absences', 'attendance']) {
    const [exists] = await conn.query(
      `SELECT 1 FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [table],
    );
    if (exists.length === 0) continue;
    const archived = `_legacy_${table}_${stamp}`;
    await conn.query(`RENAME TABLE \`${table}\` TO \`${archived}\``);
    console.log(`Archived ${table} → ${archived}`);
  }
}

async function runFile(conn, fileName) {
  const full = path.join(migrationsDir, fileName);
  const sql = fs.readFileSync(full, 'utf8');
  console.log(`\n=== Applying ${fileName} ===`);
  try {
    await conn.query(sql);
    console.log(`OK ${fileName}`);
  } catch (err) {
    const msg = String(err?.message ?? err);
    // Idempotent-ish: skip duplicate column/index/table when re-running
    if (
      /Duplicate column name/i.test(msg) ||
      /Duplicate key name/i.test(msg) ||
      /already exists/i.test(msg)
    ) {
      console.warn(`SKIP (already applied fragment): ${msg}`);
      return;
    }
    throw err;
  }
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USERNAME ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE ?? 'edusmart',
    multipleStatements: true,
  });

  try {
    await archiveLegacyAttendanceStubs(conn);
    for (const file of FILES) {
      await runFile(conn, file);
    }

    const [check] = await conn.query(`
      SELECT
        (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subjects') AS subjects,
        (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schedule_entries') AS schedule_entries,
        (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance_sessions') AS attendance_sessions,
        (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'teaching_assignments' AND COLUMN_NAME = 'offering_kind') AS offering_kind,
        (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance_sessions' AND COLUMN_NAME = 'attendance_token') AS attendance_token,
        (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'absence_justifications') AS absence_justifications
    `);
    console.log('\nVerification:', check[0]);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('\nFAILED:', err.message);
  process.exit(1);
});
