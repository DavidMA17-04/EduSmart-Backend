/**
 * Aplica la migración 031 (baselines operativos de role_permissions).
 * Credenciales desde backend/.env — no imprime secretos ni datos personales.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const FILE = '031_restore_operational_role_permissions.sql';
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

    const [teacherAttendance] = await conn.query(`
      SELECT COUNT(*) AS total
      FROM role_permissions rp
      INNER JOIN roles r ON r.id_roles = rp.id_roles
      INNER JOIN permissions p ON p.id_permissions = rp.id_permissions
      WHERE r.name = 'Docente'
        AND p.code IN ('attendance.view', 'attendance.create', 'attendance.edit')
    `);
    if (Number(teacherAttendance[0].total) < 3) {
      throw new Error('Docente still missing attendance.view/create/edit');
    }

    const [studentJustify] = await conn.query(`
      SELECT COUNT(*) AS total
      FROM role_permissions rp
      INNER JOIN roles r ON r.id_roles = rp.id_roles
      INNER JOIN permissions p ON p.id_permissions = rp.id_permissions
      WHERE r.name = 'Estudiante' AND p.code = 'attendance.justify'
    `);
    if (Number(studentJustify[0].total) < 1) {
      throw new Error('Estudiante still missing attendance.justify');
    }

    const [studentView] = await conn.query(`
      SELECT COUNT(*) AS total
      FROM role_permissions rp
      INNER JOIN roles r ON r.id_roles = rp.id_roles
      INNER JOIN permissions p ON p.id_permissions = rp.id_permissions
      WHERE r.name = 'Estudiante' AND p.code = 'attendance.view'
    `);
    if (Number(studentView[0].total) !== 0) {
      throw new Error('Estudiante still has attendance.view');
    }

    console.log('Verified: Docente attendance.* and Estudiante justify/view_own');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
