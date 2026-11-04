/**
 * Seed de demo para recorrer el flujo de cada rol (horario, asistencia, vínculos).
 * Idempotente (llaves naturales, sin duplicar). NO toca roles ni permisos:
 * para eso está `repair-qa-seed-rbac.mjs`.
 *
 * Uso:
 *   node scripts/seed-demo-flow.mjs                      # simulación (rollback)
 *   node scripts/seed-demo-flow.mjs --apply              # escribe en la BD
 *   node scripts/seed-demo-flow.mjs --apply --period-strategy=close-only
 *
 * --period-strategy:
 *   move       (por defecto) mueve los datos del período ACTIVE sin año al período
 *              lectivo vigente y cierra el huérfano.
 *   close-only solo cierra el período huérfano; no reubica grupos.
 *
 * Solo entornos de desarrollo. No imprime cédulas, correos ni contraseñas.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const STRATEGY =
  args.find((a) => a.startsWith('--period-strategy='))?.split('=')[1] ?? 'move';

/** Lecciones estándar añadidas solo si faltan (por hora de inicio). */
const STANDARD_SLOTS = [
  { lesson: 3, name: 'Lección 3', start: '08:30:00', end: '09:50:00', order: 2 },
  { lesson: 4, name: 'Lección 4', start: '10:00:00', end: '11:20:00', order: 3 },
  { lesson: 5, name: 'Lección 5', start: '12:00:00', end: '13:20:00', order: 4 },
];

/** Días (1 = lunes) por posición de la asignación dentro del seed. */
const DAY_PATTERNS = [
  [1, 3],
  [2, 4],
  [1, 3],
  [2, 4],
];

const STATUS_CYCLE = ['PRESENT', 'PRESENT', 'LATE', 'PRESENT', 'ABSENT', 'PRESENT'];

const report = [];
const note = (label, value) => report.push({ paso: label, resultado: value });

function assertDevEnvironment() {
  const host = process.env.DB_HOST ?? 'localhost';
  const local = ['localhost', '127.0.0.1', '::1'].includes(host);
  if (process.env.NODE_ENV === 'production' || !local) {
    throw new Error('El seed de demo solo corre en desarrollo local. Abortado.');
  }
  if (!['move', 'close-only'].includes(STRATEGY)) {
    throw new Error(`--period-strategy inválido: ${STRATEGY}`);
  }
}

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Últimas `count` fechas (hasta hoy) cuyo día de semana (1 = lunes) coincide. */
function lastOccurrences(dayOfWeek, count, from = new Date()) {
  const dates = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  while (dates.length < count) {
    if ((cursor.getDay() || 7) === dayOfWeek) dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }
  return dates;
}

async function normalizePeriods(conn) {
  const [orphans] = await conn.query(
    `SELECT id_academic_periods AS id FROM academic_periods
      WHERE id_academic_years IS NULL AND status = 'ACTIVE'`,
  );
  const [[current]] = await conn.query(
    `SELECT id_academic_periods AS id FROM academic_periods
      WHERE id_academic_years IS NOT NULL AND status = 'ACTIVE'
      ORDER BY start_date DESC LIMIT 1`,
  );
  if (orphans.length === 0) {
    note('periodos', 'sin períodos huérfanos');
    return current?.id ?? null;
  }
  if (!current) {
    note('periodos', 'hay huérfanos pero ningún período vigente con año; se omite');
    return null;
  }
  for (const { id } of orphans) {
    if (STRATEGY === 'move') {
      const [g] = await conn.query(
        'UPDATE `groups` SET id_academic_periods = ? WHERE id_academic_periods = ?',
        [current.id, id],
      );
      const [ta] = await conn.query(
        `UPDATE teaching_assignments
            SET id_academic_periods = ?,
                assignment_fingerprint = CONCAT(SUBSTRING_INDEX(assignment_fingerprint, ':', 5), ':', ?)
          WHERE id_academic_periods = ?`,
        [current.id, current.id, id],
      );
      const [en] = await conn.query(
        'UPDATE group_enrollments SET id_academic_periods = ? WHERE id_academic_periods = ?',
        [current.id, id],
      );
      note(
        `periodo ${id} → ${current.id}`,
        `grupos ${g.affectedRows}, asignaciones ${ta.affectedRows}, matrículas ${en.affectedRows}`,
      );
    }
    const [closed] = await conn.query(
      "UPDATE academic_periods SET status = 'CLOSED' WHERE id_academic_periods = ?",
      [id],
    );
    note(`periodo ${id}`, `cerrado (${closed.affectedRows})`);
  }
  return current.id;
}

async function ensureTimeSlots(conn) {
  let added = 0;
  for (const slot of STANDARD_SLOTS) {
    const [res] = await conn.query(
      `INSERT INTO schedule_time_slots
         (lesson_number, name, start_time, end_time, display_order, slot_type, is_active)
       SELECT ?, ?, ?, ?, ?, 'CLASS', 1 FROM DUAL
        WHERE NOT EXISTS (
          SELECT 1 FROM schedule_time_slots WHERE start_time = ? AND slot_type = 'CLASS')`,
      [slot.lesson, slot.name, slot.start, slot.end, slot.order, slot.start],
    );
    added += res.affectedRows;
  }
  note('franjas', `${added} añadidas`);
  const [slots] = await conn.query(
    `SELECT id_schedule_time_slots AS id, start_time AS start FROM schedule_time_slots
      WHERE slot_type = 'CLASS' AND is_active = 1 ORDER BY start_time`,
  );
  return slots;
}

async function seedScheduleAndAttendance(conn, slots) {
  const [assignments] = await conn.query(
    `SELECT id_teaching_assignments AS id, id_users AS teacherId, id_groups AS groupId
       FROM teaching_assignments
      WHERE offering_kind IS NOT NULL
      ORDER BY id_teaching_assignments`,
  );
  let entries = 0;
  let sessions = 0;
  let records = 0;

  for (const [index, ta] of assignments.entries()) {
    const slot = slots[index % slots.length];
    const days = DAY_PATTERNS[index % DAY_PATTERNS.length];
    const [students] = await conn.query(
      `SELECT id_users AS id FROM group_enrollments
        WHERE id_groups = ? AND status = 'ACTIVE' ORDER BY id_users`,
      [ta.groupId],
    );

    for (const day of days) {
      const [e] = await conn.query(
        `INSERT INTO schedule_entries (id_teaching_assignments, day_of_week, id_schedule_time_slots)
         SELECT ?, ?, ? FROM DUAL
          WHERE NOT EXISTS (
            SELECT 1 FROM schedule_entries
             WHERE id_teaching_assignments = ? AND day_of_week = ? AND id_schedule_time_slots = ?)`,
        [ta.id, day, slot.id, ta.id, day, slot.id],
      );
      entries += e.affectedRows;

      for (const date of lastOccurrences(day, 2)) {
        const sessionDate = ymd(date);
        const startedAt = `${sessionDate} ${slot.start}`;
        const [s] = await conn.query(
          `INSERT INTO attendance_sessions
             (id_teaching_assignments, id_schedule_entries, session_date, started_at,
              closed_at, status, id_users_created_by)
           SELECT ?,
                  (SELECT id_schedule_entries FROM schedule_entries
                    WHERE id_teaching_assignments = ? AND day_of_week = ?
                      AND id_schedule_time_slots = ? LIMIT 1),
                  ?, ?, DATE_ADD(?, INTERVAL 1 HOUR), 'CLOSED', ?
             FROM DUAL
            WHERE NOT EXISTS (
              SELECT 1 FROM attendance_sessions
               WHERE id_teaching_assignments = ? AND session_date = ?)`,
          [ta.id, ta.id, day, slot.id, sessionDate, startedAt, startedAt, ta.teacherId, ta.id, sessionDate],
        );
        sessions += s.affectedRows;

        for (const [position, student] of students.entries()) {
          const status = STATUS_CYCLE[(student.id + position + date.getDate()) % STATUS_CYCLE.length];
          const [r] = await conn.query(
            `INSERT INTO attendance
               (id_attendance_sessions, id_users_student, status, justification_status,
                registration_method, registered_at, id_users_registered_by)
             SELECT s.id_attendance_sessions, ?, ?, 'NONE', 'MANUAL', s.started_at, ?
               FROM attendance_sessions s
              WHERE s.id_teaching_assignments = ? AND s.session_date = ?
                AND NOT EXISTS (
                  SELECT 1 FROM attendance a
                   WHERE a.id_attendance_sessions = s.id_attendance_sessions
                     AND a.id_users_student = ?)`,
            [student.id, status, ta.teacherId, ta.id, sessionDate, student.id],
          );
          records += r.affectedRows;
        }
      }
    }
  }
  note('horarios', `${entries} entradas nuevas`);
  note('sesiones', `${sessions} nuevas`);
  note('asistencias', `${records} nuevas`);
}

/** Encargados activos sin ningún vínculo → un estudiante matriculado sin encargado. */
async function linkOrphanGuardians(conn) {
  const [guardians] = await conn.query(
    `SELECT u.id_users AS id FROM users u
       JOIN user_roles ur ON ur.id_users = u.id_users
       JOIN roles r ON r.id_roles = ur.id_roles AND r.name = 'Encargado'
      WHERE u.status = 'ACTIVE'
        AND NOT EXISTS (SELECT 1 FROM guardian_student_links l WHERE l.id_users_guardian = u.id_users)
      ORDER BY u.id_users`,
  );
  let linked = 0;
  for (const guardian of guardians) {
    const [[student]] = await conn.query(
      `SELECT ge.id_users AS id FROM group_enrollments ge
         JOIN user_roles ur ON ur.id_users = ge.id_users
         JOIN roles r ON r.id_roles = ur.id_roles AND r.name = 'Estudiante'
        WHERE ge.status = 'ACTIVE'
          AND NOT EXISTS (SELECT 1 FROM guardian_student_links l WHERE l.id_users_student = ge.id_users)
        ORDER BY ge.id_users LIMIT 1`,
    );
    if (!student) break;
    const [res] = await conn.query(
      `INSERT INTO guardian_student_links (id_users_guardian, id_users_student, relationship)
       SELECT ?, ?, 'Encargado' FROM DUAL
        WHERE NOT EXISTS (
          SELECT 1 FROM guardian_student_links WHERE id_users_guardian = ? AND id_users_student = ?)`,
      [guardian.id, student.id, guardian.id, student.id],
    );
    linked += res.affectedRows;
  }
  note('vínculos', `${linked} nuevos (${guardians.length} encargados sin vínculo)`);
}

async function main() {
  assertDevEnvironment();
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USERNAME ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE ?? 'edusmart',
  });

  try {
    await conn.beginTransaction();
    await normalizePeriods(conn);
    const slots = await ensureTimeSlots(conn);
    await seedScheduleAndAttendance(conn, slots);
    await linkOrphanGuardians(conn);

    if (APPLY) {
      await conn.commit();
      console.log('Seed de demo APLICADO.');
    } else {
      await conn.rollback();
      console.log('Simulación: nada se escribió (rollback). Usa --apply para aplicar.');
    }
    console.table(report);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
