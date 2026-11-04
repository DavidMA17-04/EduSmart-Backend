/**
 * Apply SQL migration 028 (teacher departments / teacher_profiles) to local MySQL.
 * Loads credentials from backend/.env — does not log secrets or personal data.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const FILE = '028_teacher_departments.sql';
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
    const sql = fs.readFileSync(path.join(migrationsDir, FILE), 'utf8');
    console.log(`Applying ${FILE}…`);
    await conn.query(sql);
    console.log(`OK ${FILE}`);

    const [tables] = await conn.query(
      `
      SELECT TABLE_NAME AS name
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('departments', 'teacher_profiles')
      ORDER BY TABLE_NAME
    `,
    );
    if (tables.length !== 2) {
      throw new Error(`Expected departments and teacher_profiles, got ${tables.map((t) => t.name).join(',') || '(none)'}`);
    }

    const [deps] = await conn.query(`SELECT COUNT(*) AS total FROM departments`);
    if (Number(deps[0].total) < 1) {
      throw new Error('departments seed is empty');
    }
    console.log(`Verified: departments (${deps[0].total}) and teacher_profiles exist`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
