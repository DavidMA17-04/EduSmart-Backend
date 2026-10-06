import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

/**
 * Minimal academic + enrollment fixtures for Sprint 3 API QA.
 * Idempotent via fixed names / national IDs.
 */
async function main() {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  const [periods] = await c.query(
    `SELECT id_academic_periods AS id FROM academic_periods WHERE status='ACTIVE' LIMIT 1`,
  );
  if (!periods.length) throw new Error('No ACTIVE academic_period');
  const periodId = periods[0].id;

  // Subject
  let [subj] = await c.query(
    `SELECT id_subjects AS id FROM subjects WHERE code='S3-MATH' LIMIT 1`,
  );
  if (!subj.length) {
    const [r] = await c.query(
      `INSERT INTO subjects (name, code, status, created_at, updated_at)
       VALUES ('Matemáticas S3 QA', 'S3-MATH', 'ACTIVE', NOW(), NOW())`,
    );
    subj = [{ id: r.insertId }];
  }
  const subjectId = subj[0].id;

  // Section
  let [sec] = await c.query(
    `SELECT id_sections AS id FROM sections WHERE name='S3 QA Sección' LIMIT 1`,
  );
  if (!sec.length) {
    const [r] = await c.query(
      `INSERT INTO sections (name, grade_level, description, id_academic_periods, id_specialties, status, created_at, updated_at)
       VALUES ('S3 QA Sección', 10, 'Fixture Sprint 3', ?, NULL, 'ACTIVE', NOW(), NOW())`,
      [periodId],
    );
    sec = [{ id: r.insertId }];
  }
  const sectionId = sec[0].id;

  // Group
  let [grp] = await c.query(
    `SELECT id_groups AS id FROM \`groups\` WHERE name='S3-10-1' LIMIT 1`,
  );
  if (!grp.length) {
    const [r] = await c.query(
      `INSERT INTO \`groups\` (name, student_count, max_capacity, id_sections, id_specialties, id_academic_periods, status, created_at, updated_at)
       VALUES ('S3-10-1', 1, 40, ?, NULL, ?, 'ACTIVE', NOW(), NOW())`,
      [sectionId, periodId],
    );
    grp = [{ id: r.insertId }];
  }
  const groupId = grp[0].id;

  // Roles
  const [roles] = await c.query(`SELECT id_roles AS id, name FROM roles`);
  const roleByName = Object.fromEntries(roles.map((r) => [r.name, r.id]));
  const studentRoleId = roleByName['Estudiante'];
  const teacherRoleId = roleByName['Docente'];
  if (!studentRoleId || !teacherRoleId) throw new Error('Missing system roles');

  // Ensure student role has view_own + justify
  const [perms] = await c.query(
    `SELECT id_permissions AS id, code FROM permissions WHERE code IN ('attendance.view_own','attendance.justify','attendance.view','attendance.create','attendance.edit','attendance.review')`,
  );
  const permId = Object.fromEntries(perms.map((p) => [p.code, p.id]));
  for (const code of ['attendance.view_own', 'attendance.justify']) {
    if (!permId[code]) continue;
    await c.query(
      `INSERT IGNORE INTO role_permissions (id_roles, id_permissions) VALUES (?, ?)`,
      [studentRoleId, permId[code]],
    );
  }
  for (const code of [
    'attendance.view',
    'attendance.create',
    'attendance.edit',
    'attendance.review',
  ]) {
    if (!permId[code]) continue;
    await c.query(
      `INSERT IGNORE INTO role_permissions (id_roles, id_permissions) VALUES (?, ?)`,
      [teacherRoleId, permId[code]],
    );
  }

  const pwdHash = await bcrypt.hash('TempPass12', 10);

  async function ensureUser(nationalId, first, last, roleId) {
    let [u] = await c.query(
      `SELECT id_users AS id FROM users WHERE national_id=? LIMIT 1`,
      [nationalId],
    );
    if (!u.length) {
      const [r] = await c.query(
        `INSERT INTO users
          (national_id, name, first_lastname, second_lastname, email, password_hash, status, must_change_password, created_at, updated_at)
         VALUES (?, ?, ?, NULL, ?, ?, 'ACTIVE', 0, NOW(), NOW())`,
        [
          nationalId,
          first,
          last,
          `${nationalId}@s3qa.local`,
          pwdHash,
        ],
      );
      u = [{ id: r.insertId }];
    } else {
      await c.query(`UPDATE users SET password_hash=?, status='ACTIVE', must_change_password=0 WHERE id_users=?`, [
        pwdHash,
        u[0].id,
      ]);
    }
    await c.query(
      `INSERT IGNORE INTO user_roles (id_users, id_roles, assigned_at) VALUES (?, ?, NOW())`,
      [u[0].id, roleId],
    );
    return u[0].id;
  }

  const teacherId = await ensureUser('300000001', 'Docente', 'S3QA', teacherRoleId);
  const studentId = await ensureUser('300000002', 'Estudiante', 'S3QA', studentRoleId);

  // Teaching assignment (admin user 1 as teacher also works; use dedicated teacher)
  let [ta] = await c.query(
    `SELECT id_teaching_assignments AS id FROM teaching_assignments
     WHERE id_groups=? AND id_subjects=? AND offering_kind='SUBJECT' LIMIT 1`,
    [groupId, subjectId],
  );
  if (!ta.length) {
    const [r] = await c.query(
      `INSERT INTO teaching_assignments
        (id_users, id_groups, id_academic_periods, is_guide_teacher, offering_kind, id_subjects, id_specialties, created_at, updated_at)
       VALUES (?, ?, ?, 0, 'SUBJECT', ?, NULL, NOW(), NOW())`,
      [teacherId, groupId, periodId, subjectId],
    );
    ta = [{ id: r.insertId }];
  }
  const teachingAssignmentId = ta[0].id;

  // Enrollment — backdate starts_on so roster includes student on CR local session dates
  let [en] = await c.query(
    `SELECT id_group_enrollments AS id FROM group_enrollments
     WHERE id_users=? AND id_groups=? AND status='ACTIVE' LIMIT 1`,
    [studentId, groupId],
  );
  if (!en.length) {
    await c.query(
      `INSERT INTO group_enrollments
        (id_users, id_groups, id_academic_periods, starts_on, ends_on, status, created_at, updated_at)
       VALUES (?, ?, ?, '2026-01-01', NULL, 'ACTIVE', NOW(), NOW())`,
      [studentId, groupId, periodId],
    );
  } else {
    await c.query(
      `UPDATE group_enrollments SET starts_on='2026-01-01' WHERE id_group_enrollments=?`,
      [en[0].id],
    );
  }

  console.log(
    JSON.stringify(
      {
        periodId,
        sectionId,
        groupId,
        subjectId,
        teachingAssignmentId,
        teacherId,
        teacherNationalId: '300000001',
        studentId,
        studentNationalId: '300000002',
        password: 'TempPass12',
      },
      null,
      2,
    ),
  );

  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
