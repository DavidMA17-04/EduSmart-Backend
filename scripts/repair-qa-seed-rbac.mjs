/**
 * Repara RBAC y cuentas QA locales (DiscQA + demo).
 * Idempotente. No imprime cédulas, correos, contraseñas ni tokens.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MIGRATION = '031_restore_operational_role_permissions.sql';
const QA_NATIONAL_IDS = [
  '809000001',
  '809000002',
  '809000003',
  '809000004',
  '809000005',
  '809000006',
  '300000010',
  '300000011',
  '300000020',
  '300000021',
  '300000022',
  '300000030',
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
    const sql = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'database', 'migrations', MIGRATION),
      'utf8',
    );
    await conn.query(sql);
    console.log('OK role_permissions restaurados');

    const [roles] = await conn.query(`SELECT id_roles AS id, name FROM roles`);
    const roleId = Object.fromEntries(roles.map((role) => [role.name, role.id]));
    const guardianRoleId = roleId.Encargado ?? roleId['Padre de familia'];
    if (!guardianRoleId) {
      throw new Error('Falta el rol Encargado o Padre de familia. Aplique la migración 027.');
    }

    const passwordHash = await bcrypt.hash('TempPass12', 10);
    const [reset] = await conn.query(
      `UPDATE users
       SET password_hash = ?, must_change_password = 0, status = 'ACTIVE', updated_at = NOW()
       WHERE national_id IN (?)`,
      [passwordHash, QA_NATIONAL_IDS],
    );
    console.log(`OK cuentas QA reactivadas: ${reset.affectedRows}`);

    const assignments = [
      { nationalId: '809000001', role: 'Docente' },
      { nationalId: '809000002', role: 'Orientador' },
      { nationalId: '809000003', role: 'Director' },
      { nationalId: '809000004', role: 'Encargado' },
      { nationalId: '809000005', role: 'Estudiante' },
      { nationalId: '809000006', role: 'Docente' },
      { nationalId: '300000010', role: 'Docente' },
      { nationalId: '300000011', role: 'Docente' },
      { nationalId: '300000020', role: 'Estudiante' },
      { nationalId: '300000021', role: 'Estudiante' },
      { nationalId: '300000022', role: 'Estudiante' },
      { nationalId: '300000030', role: 'Encargado' },
    ];

    let assigned = 0;
    for (const row of assignments) {
      const resolvedRoleId =
        row.role === 'Encargado' ? guardianRoleId : roleId[row.role];
      if (!resolvedRoleId) {
        throw new Error(`Falta el rol ${row.role}`);
      }
      const [users] = await conn.query(
        `SELECT id_users AS id FROM users WHERE national_id = ? LIMIT 1`,
        [row.nationalId],
      );
      if (!users.length) continue;
      const [result] = await conn.query(
        `INSERT IGNORE INTO user_roles (id_users, id_roles, assigned_at) VALUES (?, ?, NOW())`,
        [users[0].id, resolvedRoleId],
      );
      assigned += result.affectedRows ?? 0;
    }
    console.log(`OK roles QA asegurados (altas: ${assigned})`);

    const [teacherPerms] = await conn.query(`
      SELECT COUNT(*) AS total
      FROM role_permissions rp
      INNER JOIN roles r ON r.id_roles = rp.id_roles
      INNER JOIN permissions p ON p.id_permissions = rp.id_permissions
      WHERE r.name = 'Docente'
        AND p.code IN ('attendance.view', 'attendance.create', 'attendance.edit')
    `);
    const [studentPerms] = await conn.query(`
      SELECT COUNT(*) AS total
      FROM role_permissions rp
      INNER JOIN roles r ON r.id_roles = rp.id_roles
      INNER JOIN permissions p ON p.id_permissions = rp.id_permissions
      WHERE r.name = 'Estudiante'
        AND p.code IN ('attendance.view_own', 'attendance.justify')
    `);
    const [robertoRoles] = await conn.query(`
      SELECT COUNT(*) AS total
      FROM user_roles ur
      INNER JOIN users u ON u.id_users = ur.id_users
      WHERE u.national_id = '300000030'
    `);
    if (Number(teacherPerms[0].total) < 3) {
      throw new Error('Docente sigue sin attendance.view/create/edit');
    }
    if (Number(studentPerms[0].total) < 2) {
      throw new Error('Estudiante sigue sin view_own/justify');
    }
    if (Number(robertoRoles[0].total) < 1) {
      throw new Error('Roberto sigue sin rol');
    }
    console.log('OK verificación RBAC QA');
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error('FAILED:', error.message);
  process.exit(1);
});
