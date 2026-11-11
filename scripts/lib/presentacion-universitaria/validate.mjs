import {
  ACADEMIC_PERIODS,
  ACADEMIC_YEARS,
  assertValidEmail,
  assertValidNationalId,
  buildPersonas,
  DEMO_PERIOD_NAME,
  DEMO_YEAR_NAME,
  EMAIL_DOMAIN,
  GUARDIAN_ROLE_ALIASES,
  isSeedNationalId,
  NATIONAL_ID_PREFIX,
  SPECIALTIES,
  SUBJECTS,
} from './constants.mjs';

const REQUIRED_TABLES = [
  'users',
  'roles',
  'academic_years',
  'academic_periods',
  'specialties',
  'sections',
  'groups',
  'subjects',
  'teaching_assignments',
  'schedule_time_slots',
  'schedule_entries',
  'group_enrollments',
  'guardian_student_links',
  'attendance_sessions',
  'attendance',
  'absence_justifications',
  'absenteeism_alerts',
  'disciplinary_cases',
  'disciplinary_appeals',
  'disciplinary_infraction_types',
  'communications',
  'communication_recipients',
  'communication_reads',
  'scheduled_departure_permits',
  'student_departures',
];

const REQUIRED_ROLES = [
  'Docente',
  'Estudiante',
  'Orientador',
  'Director',
  'Guarda de Seguridad',
  ...GUARDIAN_ROLE_ALIASES,
];

export function validatePersonasStatic() {
  const { teachers, students, guardians, staff } = buildPersonas();
  const all = [...teachers, ...students, ...guardians, ...staff];
  const national = new Set();
  const emails = new Set();
  for (const p of all) {
    const nid = assertValidNationalId(p.nationalId);
  assertValidEmail(p.email);
    if (!isSeedNationalId(nid)) throw new Error(`Fuera del prefijo ${NATIONAL_ID_PREFIX}: ${nid}`);
    if (national.has(nid)) throw new Error(`Cédula duplicada en dataset: ${nid}`);
    if (emails.has(p.email)) throw new Error(`Correo duplicado: ${p.email}`);
    national.add(nid);
    emails.add(p.email);
  }
  for (const s of SPECIALTIES) {
    if (!s.name || !s.kind) throw new Error('Especialidad incompleta');
  }
  for (const s of SUBJECTS) {
    if (!s.code || !s.name) throw new Error('Asignatura incompleta');
  }
  if (ACADEMIC_YEARS.length !== 3) throw new Error('Se esperan 3 años lectivos');
  if (!ACADEMIC_PERIODS.some((p) => p.name === DEMO_PERIOD_NAME)) {
    throw new Error(`Falta período demo ${DEMO_PERIOD_NAME}`);
  }
  if (!ACADEMIC_YEARS.some((y) => y.name === DEMO_YEAR_NAME)) {
    throw new Error(`Falta año demo ${DEMO_YEAR_NAME}`);
  }
  return { userCount: all.length, nationalIds: [...national] };
}

export async function validateDatabase(conn) {
  const issues = [];
  const [tables] = await conn.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()`,
  );
  const names = new Set(tables.map((r) => r.TABLE_NAME));
  for (const t of REQUIRED_TABLES) {
    if (!names.has(t)) issues.push(`Falta tabla ${t}`);
  }

  const [roles] = await conn.query(`SELECT name FROM roles`);
  const roleNames = new Set(roles.map((r) => r.name));
  for (const role of REQUIRED_ROLES) {
    if (!roleNames.has(role) && role === 'Encargado' && roleNames.has('Padre de familia')) continue;
    if (!roleNames.has(role) && !GUARDIAN_ROLE_ALIASES.includes(role)) {
      issues.push(`Falta rol institucional: ${role}`);
    }
  }
  if (!roleNames.has('Padre de familia') && !roleNames.has('Encargado')) {
    issues.push('Falta rol Encargado / Padre de familia');
  }

  const [slotCount] = await conn.query(`SELECT COUNT(*) AS c FROM schedule_time_slots WHERE is_active = 1`);
  if (Number(slotCount[0].c) < 1) issues.push('No hay franjas horarias activas (schedule_time_slots)');

  const [activePeriods] = await conn.query(
    `SELECT id_academic_periods AS id, name, status FROM academic_periods WHERE status = 'ACTIVE'`,
  );

  const personas = buildPersonas();
  const allNationalIds = [
    ...personas.teachers,
    ...personas.students,
    ...personas.guardians,
    ...personas.staff,
  ].map((p) => p.nationalId);
  const [existingUsers] = await conn.query(
    `SELECT national_id, email FROM users WHERE national_id IN (?) OR email LIKE ?`,
    [allNationalIds, `%@${EMAIL_DOMAIN}`],
  );

  const collisionDetails = [];
  for (const row of existingUsers) {
    if (isSeedNationalId(row.national_id)) {
      collisionDetails.push(`Usuario ya existe (re-ejecución idempotente): ${row.national_id}`);
    } else {
      collisionDetails.push(`Colisión con usuario no seed: ${row.national_id}`);
      issues.push(`Colisión de cédula existente: ${row.national_id}`);
    }
  }

  let demoPeriodId = null;
  let demoYearId = null;
  const [demoPeriodRows] = await conn.query(
    `SELECT ap.id_academic_periods AS id, ap.name, ap.status, ay.name AS yearName
     FROM academic_periods ap
     LEFT JOIN academic_years ay ON ay.id_academic_years = ap.id_academic_years
     WHERE ap.name = ?`,
    [DEMO_PERIOD_NAME],
  );
  if (demoPeriodRows[0]) demoPeriodId = demoPeriodRows[0].id;

  const [demoYearRows] = await conn.query(`SELECT id_academic_years AS id FROM academic_years WHERE name = ?`, [
    DEMO_YEAR_NAME,
  ]);
  if (demoYearRows[0]) demoYearId = demoYearRows[0].id;

  const operationalPeriodId =
    demoPeriodId ??
    activePeriods[0]?.id ??
    null;

  if (!operationalPeriodId) {
    issues.push(
      `No hay período operativo: crear "${DEMO_PERIOD_NAME}" o tener un período ACTIVE antes de --apply.`,
    );
  }

  return {
    ok: issues.length === 0,
    issues,
    collisionDetails,
    activePeriods,
    demoPeriodId,
    demoYearId,
    operationalPeriodId,
    willChangeActivePeriod: false,
    note:
      'El script no promueve ni cierra períodos ACTIVE existentes. Los datos transaccionales usan el período demo 2026 si existe; si no, el primer período ACTIVE.',
  };
}

export function validateEnvironmentHost() {
  const host = process.env.DB_HOST ?? 'localhost';
  return { host, database: process.env.DB_DATABASE ?? 'EduSmart' };
}
