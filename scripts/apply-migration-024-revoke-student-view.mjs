/**
 * Apply 024_revoke_student_attendance_view.sql and print Estudiante attendance perms.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const file = path.join(
  __dirname,
  '..',
  'src',
  'database',
  'migrations',
  '024_revoke_student_attendance_view.sql',
);

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'EduSmart',
  multipleStatements: true,
});

const sql = fs.readFileSync(file, 'utf8');
console.log('=== Applying 024_revoke_student_attendance_view.sql ===');
await conn.query(sql);
console.log('OK');

const [rows] = await conn.query(
  `SELECT r.name AS role, p.code
   FROM role_permissions rp
   JOIN roles r ON r.id_roles = rp.id_roles
   JOIN permissions p ON p.id_permissions = rp.id_permissions
   WHERE r.name = 'Estudiante' AND p.code LIKE 'attendance.%'
   ORDER BY p.code`,
);
console.log(JSON.stringify(rows, null, 2));
await conn.end();
