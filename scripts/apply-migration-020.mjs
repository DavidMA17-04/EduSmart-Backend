/**
 * Apply SQL migration 020 (attendance calendar exceptions) to local MySQL.
 * Loads credentials from Backend/.env — does not log secrets.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const FILE = '020_attendance_calendar_exceptions.sql';
const migrationsDir = path.join(__dirname, '..', 'src', 'database', 'migrations');

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
    console.log(`Applying ${FILE}…`);
    await conn.query(sql);
    console.log(`OK ${FILE}`);

    const [rows] = await conn.query(`
      SELECT TABLE_NAME, ENGINE, TABLE_COLLATION
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'attendance_calendar_exceptions'
    `);
    if (!rows.length) {
      throw new Error('Table attendance_calendar_exceptions was not created');
    }
    console.log('Verified: attendance_calendar_exceptions exists');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
