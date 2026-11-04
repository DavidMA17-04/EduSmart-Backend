/**
 * Apply SQL migration 026 (disciplinary module tables) to local MySQL.
 * Loads credentials from backend/.env — does not log secrets or personal data.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const FILE = '026_disciplinary_module.sql';
const migrationsDir = path.join(__dirname, '..', 'src', 'database', 'migrations');
const EXPECTED = [
  'disciplinary_case_sequences',
  'disciplinary_cases',
  'disciplinary_evidences',
  'disciplinary_case_events',
  'disciplinary_communications',
  'disciplinary_notifications',
  'disciplinary_defenses',
  'disciplinary_appeals',
  'disciplinary_precautionary_measures',
  'disciplinary_follow_ups',
  'non_working_days',
  'disciplinary_settings',
];

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
    const full = path.join(migrationsDir, FILE);
    const sql = fs.readFileSync(full, 'utf8');
    const [stub] = await conn.query(`
      SELECT COLUMN_NAME AS name
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'disciplinary_follow_ups'
        AND COLUMN_NAME = 'disciplinary_action_id'
    `);
    if (stub.length) {
      const [countRows] = await conn.query(
        'SELECT COUNT(*) AS total FROM `disciplinary_follow_ups`',
      );
      if (Number(countRows[0].total) > 0) {
        throw new Error(
          'disciplinary_follow_ups has stub rows; refusing to replace it',
        );
      }
      await conn.query('DROP TABLE `disciplinary_follow_ups`');
      console.log('Replaced empty stub table disciplinary_follow_ups');
    }

    console.log(`Applying ${FILE}…`);
    await conn.query(sql);
    console.log(`OK ${FILE}`);

    const [rows] = await conn.query(
      `
      SELECT TABLE_NAME AS name
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN (${EXPECTED.map(() => '?').join(', ')})
    `,
      EXPECTED,
    );
    const found = new Set(rows.map((row) => row.name));
    const missing = EXPECTED.filter((name) => !found.has(name));
    if (missing.length) {
      throw new Error(`Missing tables: ${missing.join(', ')}`);
    }
    console.log(`Verified: ${EXPECTED.length} disciplinary tables exist`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
