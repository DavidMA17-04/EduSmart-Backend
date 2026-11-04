/**
 * Bootstrap local Docker MySQL for EduSmart when the DB is empty.
 * Creates typeorm_metadata, applies SQL migrations in order, then reports table count.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function main() {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '12345',
    database: process.env.DB_DATABASE || 'EduSmart',
    multipleStatements: true,
  });

  await c.query(`
    CREATE TABLE IF NOT EXISTS typeorm_metadata (
      type varchar(255) NOT NULL,
      \`database\` varchar(255) DEFAULT NULL,
      \`schema\` varchar(255) DEFAULT NULL,
      \`table\` varchar(255) DEFAULT NULL,
      name varchar(255) DEFAULT NULL,
      value text
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('typeorm_metadata ready');

  const dir = path.join(__dirname, '../src/database/migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    process.stdout.write(`running ${file}... `);
    try {
      await c.query(fs.readFileSync(path.join(dir, file), 'utf8'));
      console.log('ok');
    } catch (error) {
      console.log('WARN', error.code || error.message);
    }
  }

  const [tables] = await c.query('SHOW TABLES');
  console.log('tables:', tables.length);
  await c.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
