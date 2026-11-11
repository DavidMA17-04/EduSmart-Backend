import { buildPersonas, EMAIL_DOMAIN, NATIONAL_ID_PREFIX } from './constants.mjs';
import { validatePersonasStatic } from './validate.mjs';

async function scalar(conn, sql, params = []) {
  const [rows] = await conn.query(sql, params);
  return Object.values(rows[0] ?? {})[0];
}

export async function runPresentationInspect(conn) {
  validatePersonasStatic();
  const ping = await scalar(conn, 'SELECT 1 AS ok');
  if (ping !== 1) throw new Error('SELECT 1 falló');

  const currentDb = await scalar(conn, 'SELECT DATABASE() AS db');
  const tls = { connected: true, database: currentDb };

  const [tables] = await conn.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME`,
  );
  const tableNames = tables.map((r) => r.TABLE_NAME);

  const counts = {};
  const countIf = async (label, sql) => {
    if (!tableNames.some((t) => sql.includes(t))) {
      counts[label] = 'N/A';
      return;
    }
    counts[label] = Number(await scalar(conn, sql));
  };

  await countIf('users_total', 'SELECT COUNT(*) AS c FROM users');
  await countIf('users_active', `SELECT COUNT(*) AS c FROM users WHERE status = 'ACTIVE'`);
  await countIf('roles', 'SELECT COUNT(*) AS c FROM roles');
  await countIf('academic_years', 'SELECT COUNT(*) AS c FROM academic_years');
  await countIf('academic_periods', 'SELECT COUNT(*) AS c FROM academic_periods');
  await countIf('academic_periods_active', `SELECT COUNT(*) AS c FROM academic_periods WHERE status = 'ACTIVE'`);
  await countIf('specialties', 'SELECT COUNT(*) AS c FROM specialties');
  await countIf('specialties_workshop', `SELECT COUNT(*) AS c FROM specialties WHERE kind = 'EXPLORATORY_WORKSHOP'`);
  await countIf('sections', 'SELECT COUNT(*) AS c FROM sections');
  await countIf('groups', 'SELECT COUNT(*) AS c FROM `groups`');
  await countIf('subjects', 'SELECT COUNT(*) AS c FROM subjects');
  await countIf('teaching_assignments', 'SELECT COUNT(*) AS c FROM teaching_assignments');
  await countIf('schedule_time_slots', 'SELECT COUNT(*) AS c FROM schedule_time_slots WHERE is_active = 1');
  await countIf('schedule_entries', 'SELECT COUNT(*) AS c FROM schedule_entries');
  await countIf('group_enrollments', 'SELECT COUNT(*) AS c FROM group_enrollments');
  await countIf('attendance_sessions', 'SELECT COUNT(*) AS c FROM attendance_sessions');
  await countIf('attendance', 'SELECT COUNT(*) AS c FROM attendance');
  await countIf('absence_justifications', 'SELECT COUNT(*) AS c FROM absence_justifications');
  await countIf('disciplinary_cases', 'SELECT COUNT(*) AS c FROM disciplinary_cases');
  await countIf('disciplinary_appeals', 'SELECT COUNT(*) AS c FROM disciplinary_appeals');
  await countIf('communications', 'SELECT COUNT(*) AS c FROM communications');
  await countIf('student_departures', 'SELECT COUNT(*) AS c FROM student_departures');

  const [roleCounts] = await conn.query(`
    SELECT r.name AS role, COUNT(DISTINCT ur.id_users) AS cnt
    FROM roles r
    LEFT JOIN user_roles ur ON ur.id_roles = r.id_roles
    GROUP BY r.name ORDER BY r.name`);

  const [years] = await conn.query(`
    SELECT ay.name, ay.status, COUNT(ap.id_academic_periods) AS periods
    FROM academic_years ay
    LEFT JOIN academic_periods ap ON ap.id_academic_years = ay.id_academic_years
    GROUP BY ay.id_academic_years, ay.name, ay.status ORDER BY ay.name`);

  const [periods] = await conn.query(`
    SELECT ap.name, ap.status, ay.name AS academic_year
    FROM academic_periods ap
    LEFT JOIN academic_years ay ON ay.id_academic_years = ap.id_academic_years
    ORDER BY ap.id_academic_periods`);

  const personas = buildPersonas();
  const probeIds = [
    ...personas.teachers,
    ...personas.students,
    ...personas.guardians,
    ...personas.staff,
  ].map((p) => p.nationalId);

  const [collidingUsers] = await conn.query(
    `SELECT national_id FROM users WHERE national_id IN (?) OR email LIKE ?`,
    [probeIds, `%@${EMAIL_DOMAIN}`],
  );
  const [prefixExisting] = await conn.query(
    `SELECT COUNT(*) AS c FROM users WHERE national_id LIKE ?`,
    [`${NATIONAL_ID_PREFIX}%`],
  );

  return {
    mode: 'inspect',
    tls,
    tables: { count: tableNames.length },
    aggregateCounts: counts,
    roleCounts,
    academicYears: years,
    academicPeriods: periods,
    datasetCollisions: {
      existingSeedIdentifiers: collidingUsers.map((r) => r.national_id),
      usersWithPrefix801099: Number(prefixExisting[0].c),
    },
    planUsersToCreate: 72 - collidingUsers.length,
  };
}
