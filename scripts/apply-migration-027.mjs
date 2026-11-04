/**
 * Apply SQL migration 027 (disciplinary roles and permissions) to local MySQL.
 * Loads credentials from backend/.env — does not log secrets or personal data.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const FILE = '027_disciplinary_roles_permissions.sql';
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

    const [roles] = await conn.query(
      `SELECT name FROM roles WHERE name IN ('Orientador', 'Director', 'Encargado') ORDER BY name`,
    );
    if (roles.length !== 3) {
      throw new Error('Expected roles Orientador, Director and Encargado');
    }

    const [revoked] = await conn.query(
      `
      SELECT COUNT(*) AS total
      FROM role_permissions rp
      INNER JOIN roles r ON r.id_roles = rp.id_roles
      INNER JOIN permissions p ON p.id_permissions = rp.id_permissions
      WHERE r.name = 'Docente' AND p.code = 'disciplinary.view'
    `,
    );
    if (Number(revoked[0].total) !== 0) {
      throw new Error('Docente still has disciplinary.view');
    }
    console.log('Verified: roles exist and Docente no longer has disciplinary.view');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
