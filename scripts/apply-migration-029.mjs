/**
 * Apply SQL migration 029 (communications module) to local MySQL.
 * Loads credentials from backend/.env — does not log secrets or personal data.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const FILE = '029_communications_module.sql';
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
        AND TABLE_NAME IN ('communications', 'communication_recipients', 'communication_reads')
      ORDER BY TABLE_NAME
    `,
    );
    if (tables.length !== 3) {
      throw new Error(
        `Expected communications tables, got ${tables.map((t) => t.name).join(',') || '(none)'}`,
      );
    }

    const [perms] = await conn.query(
      `SELECT COUNT(*) AS total FROM permissions WHERE module = 'COMMUNICATIONS'`,
    );
    console.log(`Verified: communications tables and ${perms[0].total} COMMUNICATIONS permissions`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
