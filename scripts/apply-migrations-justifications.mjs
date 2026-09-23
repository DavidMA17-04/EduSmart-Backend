/**
 * Apply pending attendance migrations (justifications + JUSTIFIED + guardian bridge).
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
  '018_attendance_justifications.sql',
  '019_attendance_status_justified.sql',
  '019_attendance_guardian_bridge.sql',
];

async function runFile(conn, fileName) {
  const full = path.join(migrationsDir, fileName);
  if (!fs.existsSync(full)) {
    throw new Error(`Missing migration file: ${fileName}`);
  }
  const sql = fs.readFileSync(full, 'utf8');
  console.log(`\n=== Applying ${fileName} ===`);
  try {
    await conn.query(sql);
    console.log(`OK ${fileName}`);
  } catch (err) {
    const msg = String(err?.message ?? err);
    if (
      /Duplicate column name/i.test(msg) ||
      /Duplicate key name/i.test(msg) ||
      /already exists/i.test(msg) ||
      /Duplicate entry/i.test(msg)
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
    for (const file of FILES) {
      await runFile(conn, file);
    }

    const [check] = await conn.query(`
      SELECT
        (SELECT COUNT(*) FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'absence_justifications') AS absence_justifications,
        (SELECT COUNT(*) FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'justification_evidences') AS justification_evidences,
        (SELECT COUNT(*) FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'guardian_student_links') AS guardian_student_links,
        (SELECT COUNT(*) FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance'
            AND COLUMN_NAME = 'justification_status') AS justification_status_col,
        (SELECT COUNT(*) FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance'
            AND COLUMN_NAME = 'status'
            AND COLUMN_TYPE LIKE '%JUSTIFIED%') AS status_has_justified
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
