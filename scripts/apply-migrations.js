/**
 * Apply SQL migrations in order against the local EduSmart database.
 * Safe to re-run for IF NOT EXISTS migrations; later ones may fail if already applied.
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

const dir = path.join(__dirname, '../src/database/migrations');
const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || 'changeme',
    database: process.env.DB_DATABASE || 'EduSmart',
    multipleStatements: true,
  });

  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    process.stdout.write(`Applying ${file}... `);
    try {
      await conn.query(sql);
      console.log('ok');
    } catch (error) {
      console.log('FAIL:', error.code || error.message);
      // Continue: some migrations are idempotent / may conflict with earlier ones.
    }
  }

  const [tables] = await conn.query('SHOW TABLES');
  console.log(`Tables now: ${tables.length}`);
  await conn.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
