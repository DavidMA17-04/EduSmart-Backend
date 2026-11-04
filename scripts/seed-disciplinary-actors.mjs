/**
 * Usuarios de prueba del módulo disciplinario.
 * Idempotente. No imprime cédulas, correos, contraseñas ni matrículas.
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const ACTORS = [
  { key: 'docente', nationalId: '809000001', name: 'Docente', last: 'DiscQA', role: 'Docente' },
  { key: 'orientador', nationalId: '809000002', name: 'Orientador', last: 'DiscQA', role: 'Orientador' },
  { key: 'director', nationalId: '809000003', name: 'Director', last: 'DiscQA', role: 'Director' },
  { key: 'encargado', nationalId: '809000004', name: 'Encargado', last: 'DiscQA', role: 'Encargado' },
  { key: 'estudiante', nationalId: '809000005', name: 'Estudiante', last: 'DiscQA', role: 'Estudiante' },
  { key: 'docente_ajeno', nationalId: '809000006', name: 'Docente ajeno', last: 'DiscQA', role: 'Docente' },
];

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  try {
    const [periods] = await conn.query(
      `SELECT id_academic_periods AS id FROM academic_periods WHERE status = 'ACTIVE' LIMIT 1`,
    );
    if (!periods.length) throw new Error('No hay un período lectivo activo');
    const periodId = periods[0].id;

    const [roles] = await conn.query(`SELECT id_roles AS id, name FROM roles`);
    const roleId = Object.fromEntries(roles.map((role) => [role.name, role.id]));
    for (const actor of ACTORS) {
      if (!roleId[actor.role]) throw new Error(`Falta el rol ${actor.role}. Aplique la migración 027.`);
    }

    const passwordHash = await bcrypt.hash('TempPass12', 10);
    const ids = {};
    for (const actor of ACTORS) {
      ids[actor.key] = await ensureUser(conn, actor, roleId[actor.role], passwordHash);
    }

    const sectionId = await ensureSection(conn, periodId);
    const groupId = await ensureGroup(conn, sectionId, periodId);
    const subjectId = await ensureSubject(conn);
    await ensureGuide(conn, ids.docente, groupId, periodId, subjectId);
    await ensureEnrollment(conn, ids.estudiante, groupId, periodId);
    await ensureLink(conn, ids.encargado, ids.estudiante);
    await ensureInfraction(conn, 'Incumplimiento de deberes (QA)', 'MINOR', 'Art. 154 REAC');
    await ensureInfraction(conn, 'Agresión a un compañero (QA)', 'SERIOUS', 'Art. 155 REAC');

    const [linked] = await conn.query(
      `SELECT COUNT(*) AS total FROM guardian_student_links WHERE id_users_guardian = ? AND id_users_student = ?`,
      [ids.encargado, ids.estudiante],
    );
    const [guides] = await conn.query(
      `SELECT COUNT(*) AS total FROM teaching_assignments WHERE id_users = ? AND id_groups = ? AND is_guide_teacher = 1`,
      [ids.docente, groupId],
    );
    if (Number(linked[0].total) < 1 || Number(guides[0].total) < 1) {
      throw new Error('El vínculo o la guía no quedó registrado');
    }
    console.log('OK actores: docente, orientador, director, encargado, estudiante, docente ajeno');
    console.log('OK vínculo encargado-estudiante y docente guía de la sección');
  } finally {
    await conn.end();
  }
}

async function ensureUser(conn, actor, role, passwordHash) {
  const [found] = await conn.query(`SELECT id_users AS id FROM users WHERE national_id = ? LIMIT 1`, [actor.nationalId]);
  let id = found[0]?.id;
  if (!id) {
    const [created] = await conn.query(
      `INSERT INTO users
        (national_id, name, first_lastname, second_lastname, email, password_hash, status, must_change_password, created_at, updated_at)
       VALUES (?, ?, ?, NULL, ?, ?, 'ACTIVE', 0, NOW(), NOW())`,
      [actor.nationalId, actor.name, actor.last, `${actor.key}.discqa@edusmart.test`, passwordHash],
    );
    id = created.insertId;
  } else {
    await conn.query(
      `UPDATE users SET password_hash = ?, must_change_password = 0, status = 'ACTIVE', updated_at = NOW() WHERE id_users = ?`,
      [passwordHash, id],
    );
  }
  await conn.query(`INSERT IGNORE INTO user_roles (id_users, id_roles, assigned_at) VALUES (?, ?, NOW())`, [id, role]);
  return id;
}

async function ensureSection(conn, periodId) {
  const [found] = await conn.query(`SELECT id_sections AS id FROM sections WHERE name = 'Disciplina QA' LIMIT 1`);
  if (found.length) return found[0].id;
  const [created] = await conn.query(
    `INSERT INTO sections (name, grade_level, description, id_academic_periods, id_specialties, status, created_at, updated_at)
     VALUES ('Disciplina QA', 10, 'Sección de prueba del módulo disciplinario', ?, NULL, 'ACTIVE', NOW(), NOW())`,
    [periodId],
  );
  return created.insertId;
}

async function ensureGroup(conn, sectionId, periodId) {
  const [found] = await conn.query(`SELECT id_groups AS id FROM \`groups\` WHERE name = 'D4-10-A' LIMIT 1`);
  if (found.length) return found[0].id;
  const [created] = await conn.query(
    `INSERT INTO \`groups\` (name, student_count, max_capacity, id_sections, id_specialties, id_academic_periods, status, created_at, updated_at)
     VALUES ('D4-10-A', 0, 40, ?, NULL, ?, 'ACTIVE', NOW(), NOW())`,
    [sectionId, periodId],
  );
  return created.insertId;
}

async function ensureSubject(conn) {
  const [found] = await conn.query(`SELECT id_subjects AS id FROM subjects WHERE code = 'D4-QA' LIMIT 1`);
  if (found.length) return found[0].id;
  const [created] = await conn.query(
    `INSERT INTO subjects (name, code, status, created_at, updated_at)
     VALUES ('Orientación QA', 'D4-QA', 'ACTIVE', NOW(), NOW())`,
  );
  return created.insertId;
}

async function ensureGuide(conn, teacherId, groupId, periodId, subjectId) {
  const [found] = await conn.query(
    `SELECT id_teaching_assignments AS id FROM teaching_assignments
     WHERE id_users = ? AND id_groups = ? AND offering_kind = 'SUBJECT' AND id_subjects = ? LIMIT 1`,
    [teacherId, groupId, subjectId],
  );
  if (!found.length) {
    const fingerprint = `${teacherId}:${groupId}:SUBJECT:${subjectId}:0:${periodId}`;
    await conn.query(
      `INSERT INTO teaching_assignments
        (id_users, id_groups, id_academic_periods, is_guide_teacher, offering_kind, id_subjects, id_specialties, assignment_fingerprint, created_at, updated_at)
       VALUES (?, ?, ?, 1, 'SUBJECT', ?, NULL, ?, NOW(), NOW())`,
      [teacherId, groupId, periodId, subjectId, fingerprint],
    );
    return;
  }
  await conn.query(`UPDATE teaching_assignments SET is_guide_teacher = 1 WHERE id_teaching_assignments = ?`, [found[0].id]);
}

async function ensureEnrollment(conn, studentId, groupId, periodId) {
  const [found] = await conn.query(
    `SELECT id_group_enrollments AS id FROM group_enrollments WHERE id_users = ? AND id_groups = ? AND status = 'ACTIVE' LIMIT 1`,
    [studentId, groupId],
  );
  if (found.length) return;
  await conn.query(
    `INSERT INTO group_enrollments
      (id_users, id_groups, id_academic_periods, starts_on, ends_on, status, created_at, updated_at)
     VALUES (?, ?, ?, '2026-01-01', NULL, 'ACTIVE', NOW(), NOW())`,
    [studentId, groupId, periodId],
  );
}

async function ensureLink(conn, guardianId, studentId) {
  await conn.query(
    `INSERT IGNORE INTO guardian_student_links (id_users_guardian, id_users_student, relationship)
     VALUES (?, ?, 'Encargado')`,
    [guardianId, studentId],
  );
}

async function ensureInfraction(conn, name, severity, legalReference) {
  const [found] = await conn.query(
    `SELECT id_disciplinary_infraction_types AS id FROM disciplinary_infraction_types WHERE name = ? AND severity = ? LIMIT 1`,
    [name, severity],
  );
  if (found.length) return;
  await conn.query(
    `INSERT INTO disciplinary_infraction_types (name, description, severity, legal_reference, is_active)
     VALUES (?, 'Tipo de prueba del módulo disciplinario', ?, ?, 1)`,
    [name, severity, legalReference],
  );
}

main().catch((error) => {
  console.error('FAILED:', error.message);
  process.exit(1);
});
