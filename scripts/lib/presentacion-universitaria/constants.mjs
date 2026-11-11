/**
 * Constantes del dataset de presentación universitaria (CTP Hojancha).
 * Identificadores sintéticos: 9 dígitos, prefijo 801099 (reservado en el script, no implica validez tributaria).
 */

export const MANIFEST_VERSION = 1;
export const MANIFEST_DEFAULT_PATH = 'scripts/.manifest-presentacion-universitaria.json';

/** Prefijo de cédulas ficticias del seed (9–12 dígitos permitidos en login). */
export const NATIONAL_ID_PREFIX = '801099';

export const EMAIL_DOMAIN = 'example.invalid';

export const IDEMPOTENCY_PREFIX = 'pres_univ_';

/** Marcador interno en descripciones / motivos (no visible en títulos de UI). */
export const INTERNAL_TAG = 'PU-SEED';

export const DEMO_PASSWORD_ENV = 'PRESENTACION_DEMO_PASSWORD';

export const ACADEMIC_YEARS = [
  { name: 'Año lectivo 2025', year: 2025, start: '2025-02-03', end: '2025-11-28', status: 'CLOSED' },
  { name: 'Año lectivo 2026', year: 2026, start: '2026-02-02', end: '2026-11-27', status: 'ACTIVE' },
  { name: 'Año lectivo 2027', year: 2027, start: '2027-02-01', end: '2027-11-26', status: 'PLANNED' },
];

export const ACADEMIC_PERIODS = [
  { yearKey: 2025, name: 'I semestre 2025', start: '2025-02-03', end: '2025-06-30', status: 'CLOSED' },
  { yearKey: 2025, name: 'II semestre 2025', start: '2025-07-14', end: '2025-11-28', status: 'CLOSED' },
  { yearKey: 2026, name: 'I semestre 2026', start: '2026-02-02', end: '2026-06-26', status: 'PLANNED' },
  { yearKey: 2026, name: 'II semestre 2026', start: '2026-07-13', end: '2026-11-27', status: 'PLANNED' },
  { yearKey: 2027, name: 'I semestre 2027', start: '2027-02-01', end: '2027-06-25', status: 'PLANNED' },
];

/** Período de referencia para la demostración (nombre lógico; no fuerza status ACTIVE en BD). */
export const DEMO_PERIOD_NAME = 'I semestre 2026';
export const DEMO_YEAR_NAME = 'Año lectivo 2026';

export const SPECIALTIES = [
  {
    key: 'info',
    name: 'Informática en Desarrollo de Software',
    kind: 'TECHNICAL_SPECIALTY',
    description: 'Programación, bases de datos y proyectos de software.',
  },
  {
    key: 'conta',
    name: 'Contabilidad y Finanzas',
    kind: 'TECHNICAL_SPECIALTY',
    description: 'Registros contables y análisis financiero.',
  },
  {
    key: 'electro',
    name: 'Electricidad Industrial',
    kind: 'TECHNICAL_SPECIALTY',
    description: 'Instalaciones eléctricas y mantenimiento industrial.',
  },
  {
    key: 'robo',
    name: 'Robótica y Automatización',
    kind: 'EXPLORATORY_WORKSHOP',
    description: 'Taller exploratorio de robótica educativa.',
  },
  {
    key: 'arte',
    name: 'Artes Digitales',
    kind: 'EXPLORATORY_WORKSHOP',
    description: 'Diseño gráfico y producción multimedia.',
  },
];

export const SUBJECTS = [
  { code: 'ESP-10', name: 'Español' },
  { code: 'MAT-10', name: 'Matemática' },
  { code: 'CIV-10', name: 'Educación Cívica' },
  { code: 'ING-11', name: 'Inglés técnico' },
  { code: 'PROG-11', name: 'Programación I' },
  { code: 'BASE-11', name: 'Bases de datos' },
  { code: 'RED-12', name: 'Redes de datos' },
  { code: 'EMP-12', name: 'Emprendimiento' },
];

export const GUARDIAN_ROLE_ALIASES = ['Encargado', 'Padre de familia'];

const TEACHER_FIRST = ['María', 'Carlos', 'Ana', 'José', 'Laura', 'Pedro', 'Sofía', 'Luis', 'Gabriela'];
const TEACHER_LAST = ['Solano', 'Vargas', 'Rojas', 'Mora', 'Jiménez', 'Chaves', 'Araya', 'Salazar', 'Quesada'];

const STUDENT_FIRST = [
  'Andrés', 'Valeria', 'Sebastián', 'Natalia', 'Mateo', 'Camila', 'Diego', 'Mariana', 'Alejandro', 'Paula',
  'Daniel', 'Andrea', 'Emilio', 'Karla', 'Iván', 'Melissa', 'Óscar', 'Jimena', 'Tomás', 'Fabiola',
  'Esteban', 'Kiara', 'Bryan', 'Yoselyn', 'Fabricio', 'Hazel', 'Josue', 'Lía', 'Marco', 'Rebeca',
  'Samuel', 'Dayana', 'Ulises', 'Jessica', 'Adrián',
];
const STUDENT_LAST = [
  'Aguilar', 'Brenes', 'Cordero', 'Duarte', 'Espinoza', 'Fallas', 'González', 'Herrera', 'Loría', 'Méndez',
  'Navarro', 'Obando', 'Porras', 'Quirós', 'Ramírez', 'Sánchez', 'Trejos', 'Umaña', 'Vega', 'Zúñiga',
  'Alvarado', 'Castillo', 'Fernández', 'Gutiérrez', 'Hidalgo', 'León', 'Montoya', 'Núñez', 'Pérez', 'Rivas',
  'Sandí', 'Torres', 'Valverde', 'Vindas', 'Zamora',
];

const GUARDIAN_FIRST = [
  'Roberto', 'Elena', 'Mario', 'Claudia', 'Francisco', 'Teresa', 'Ricardo', 'Gloria', 'Manuel', 'Patricia',
  'Jorge', 'Silvia', 'Alberto', 'Rosa', 'Héctor', 'Maribel', 'Edgar', 'Lucía', 'Guillermo', 'Xinia',
  'Alfredo', 'Marlen', 'Walter', 'Indira', 'Ronald',
];
const GUARDIAN_LAST = [
  'Aguilar', 'Brenes', 'Cordero', 'Duarte', 'Espinoza', 'Fallas', 'González', 'Herrera', 'Loría', 'Méndez',
  'Navarro', 'Obando', 'Porras', 'Quirós', 'Ramírez', 'Sánchez', 'Trejos', 'Umaña', 'Vega', 'Zúñiga',
  'Alvarado', 'Castillo', 'Fernández', 'Gutiérrez', 'Hidalgo',
];

function nationalId(seq) {
  const suffix = String(seq).padStart(3, '0');
  return `${NATIONAL_ID_PREFIX}${suffix}`;
}

function emailFor(roleSlug, nationalIdValue, seq) {
  return `${roleSlug}.${nationalIdValue}.${seq}@${EMAIL_DOMAIN}`.toLowerCase();
}

export function buildPersonas() {
  const teachers = TEACHER_FIRST.map((name, i) => ({
    key: `doc_${i + 1}`,
    role: 'Docente',
    nationalId: nationalId(100 + i + 1),
    name,
    firstLastname: TEACHER_LAST[i] ?? 'Castro',
    secondLastname: i % 2 === 0 ? 'Méndez' : null,
    email: emailFor('docente', nationalId(100 + i + 1), i + 1),
  }));

  const students = STUDENT_FIRST.map((name, i) => ({
    key: `est_${i + 1}`,
    role: 'Estudiante',
    nationalId: nationalId(200 + i + 1),
    name,
    firstLastname: STUDENT_LAST[i] ?? 'Castro',
    secondLastname: i % 3 === 0 ? 'Ríos' : null,
    email: emailFor('estudiante', nationalId(200 + i + 1), i + 1),
  }));

  const guardians = GUARDIAN_FIRST.map((name, i) => ({
    key: `enc_${i + 1}`,
    role: 'Encargado',
    nationalId: nationalId(300 + i + 1),
    name,
    firstLastname: GUARDIAN_LAST[i] ?? 'Rojas',
    secondLastname: null,
    email: emailFor('encargado', nationalId(300 + i + 1), i + 1),
  }));

  const staff = [
    {
      key: 'orientador',
      role: 'Orientador',
      nationalId: nationalId(401),
      name: 'Patricia',
      firstLastname: 'Campos',
      secondLastname: 'Arias',
      email: emailFor('orientador', nationalId(401), 1),
    },
    {
      key: 'director',
      role: 'Director',
      nationalId: nationalId(402),
      name: 'Eduardo',
      firstLastname: 'Miranda',
      secondLastname: 'López',
      email: emailFor('director', nationalId(402), 1),
    },
    {
      key: 'guarda',
      role: 'Guarda de Seguridad',
      nationalId: nationalId(403),
      name: 'Hernán',
      firstLastname: 'Picado',
      secondLastname: 'Solís',
      email: emailFor('guarda', nationalId(403), 1),
    },
  ];

  return { teachers, students, guardians, staff };
}

export function isSeedNationalId(nationalIdValue) {
  const digits = String(nationalIdValue ?? '').replace(/\D/g, '');
  return digits.startsWith(NATIONAL_ID_PREFIX);
}

export function assertValidNationalId(nationalIdValue) {
  const digits = String(nationalIdValue ?? '').replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 12) {
    throw new Error(`Cédula sintética inválida (${digits.length} dígitos): ${nationalIdValue}`);
  }
  if (!/^\d+$/.test(digits)) throw new Error(`Cédula debe ser numérica: ${nationalIdValue}`);
  return digits;
}

export function assertValidEmail(email) {
  if (!email?.endsWith(`@${EMAIL_DOMAIN}`)) {
    throw new Error(`Correo fuera del dominio reservado: ${email}`);
  }
  return email.toLowerCase();
}

export function dryRunPlanSummary() {
  const { teachers, students, guardians, staff } = buildPersonas();
  return {
    academic_years: ACADEMIC_YEARS.length,
    academic_periods: ACADEMIC_PERIODS.length,
    specialties: SPECIALTIES.length,
    subjects: SUBJECTS.length,
    sections: 8,
    groups: 10,
    users: teachers.length + students.length + guardians.length + staff.length,
    teachers: teachers.length,
    students: students.length,
    guardians: guardians.length,
    staff: staff.length,
    teaching_assignments: 28,
    schedule_entries: 48,
    enrollments: students.length,
    guardian_links: 40,
    attendance_sessions: 12,
    attendance_marks: 180,
    justifications: 8,
    absenteeism_alerts: 5,
    disciplinary_cases: 6,
    disciplinary_appeals: 3,
    disciplinary_notifications: 2,
    communications: 6,
    departure_permits: 4,
    student_departures: 6,
  };
}
