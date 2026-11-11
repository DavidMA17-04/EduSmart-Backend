import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import {
  ACADEMIC_PERIODS,
  ACADEMIC_YEARS,
  buildPersonas,
  DEMO_PERIOD_NAME,
  DEMO_YEAR_NAME,
  IDEMPOTENCY_PREFIX,
  INTERNAL_TAG,
  SPECIALTIES,
  SUBJECTS,
  DEMO_PASSWORD_ENV,
} from './constants.mjs';
import { emptyManifest, pushId } from './manifest.mjs';

const ymd = (d) => d.toISOString().slice(0, 10);

async function insertIgnore(conn, sql, params) {
  const [result] = await conn.query(sql, params);
  return result;
}

async function selectId(conn, sql, params) {
  const [rows] = await conn.query(sql, params);
  return rows[0]?.id ?? null;
}

export async function applyPresentationSeed(conn, validation, log = console.log) {
  const manifest = emptyManifest();
  const ctx = {
    periodId: validation.operationalPeriodId,
    yearIds: new Map(),
    periodIds: new Map(),
    specialtyIds: new Map(),
    subjectIds: new Map(),
    sectionIds: new Map(),
    groupIds: new Map(),
    userIds: new Map(),
    roleIds: new Map(),
    teachingIds: new Map(),
    slots: [],
    personas: buildPersonas(),
  };
  manifest.demoPeriodId = ctx.periodId;

  const [roles] = await conn.query(`SELECT id_roles AS id, name FROM roles`);
  for (const r of roles) ctx.roleIds.set(r.name, r.id);

  const passwordPlain = process.env[DEMO_PASSWORD_ENV];
  if (!passwordPlain || passwordPlain.length < 12) {
    throw new Error(`Defina ${DEMO_PASSWORD_ENV} (mín. 12 caracteres) antes de --apply.`);
  }
  const passwordHash = await bcrypt.hash(passwordPlain, 10);

  await conn.beginTransaction();
  try {
    await seedAcademicStructure(conn, ctx, manifest, log);
    await seedCatalogs(conn, ctx, manifest, log);
    await seedSectionsAndGroups(conn, ctx, manifest, log);
    await seedUsers(conn, ctx, manifest, passwordHash, log);
    await seedAssignmentsAndSchedule(conn, ctx, manifest, log);
    await seedEnrollmentsAndLinks(conn, ctx, manifest, log);
    await seedAttendance(conn, ctx, manifest, log);
    await seedDiscipline(conn, ctx, manifest, log);
    await seedCommunications(conn, ctx, manifest, log);
    await seedDepartures(conn, ctx, manifest, log);
    await refreshGroupCounts(conn, ctx.groupIds, log);
    manifest.appliedAt = new Date().toISOString();
    await conn.commit();
    log('[OK] Transacción confirmada.');
    return manifest;
  } catch (err) {
    await conn.rollback();
    throw err;
  }
}

async function seedAcademicStructure(conn, ctx, manifest, log) {
  for (const y of ACADEMIC_YEARS) {
    let id = await selectId(conn, `SELECT id_academic_years AS id FROM academic_years WHERE name = ?`, [y.name]);
    if (!id) {
      const insertStatus = y.name === DEMO_YEAR_NAME ? 'PLANNED' : y.status;
      const [res] = await conn.query(
        `INSERT INTO academic_years (name, start_date, end_date, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, NOW(), NOW())`,
        [y.name, y.start, y.end, insertStatus],
      );
      id = res.insertId;
      pushId(manifest, 'academic_years', id);
      log(`Año lectivo creado: ${y.name}`);
    }
    ctx.yearIds.set(y.year, id);
  }

  for (const p of ACADEMIC_PERIODS) {
    const yearId = ctx.yearIds.get(p.yearKey);
    let id = await selectId(
      conn,
      `SELECT id_academic_periods AS id FROM academic_periods WHERE name = ? AND id_academic_years = ?`,
      [p.name, yearId],
    );
    if (!id) {
      const status = p.name === DEMO_PERIOD_NAME ? 'PLANNED' : p.status;
      const [res] = await conn.query(
        `INSERT INTO academic_periods (id_academic_years, name, start_date, end_date, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [yearId, p.name, p.start, p.end, status],
      );
      id = res.insertId;
      pushId(manifest, 'academic_periods', id);
      log(`Período creado: ${p.name} (${status})`);
    }
    ctx.periodIds.set(p.name, id);
    if (p.name === DEMO_PERIOD_NAME && !ctx.periodId) ctx.periodId = id;
  }

  if (!ctx.periodId) {
    const demoId = ctx.periodIds.get(DEMO_PERIOD_NAME);
    ctx.periodId = demoId ?? ctx.periodId;
  }
  manifest.demoPeriodId = ctx.periodId;
  log(`Período operativo para datos transaccionales: id=${ctx.periodId}`);
}

async function seedCatalogs(conn, ctx, manifest, log) {
  for (const s of SPECIALTIES) {
    let id = await selectId(conn, `SELECT id_specialties AS id FROM specialties WHERE name = ?`, [s.name]);
    if (!id) {
      const [res] = await conn.query(
        `INSERT INTO specialties (name, description, status, kind, created_at, updated_at)
         VALUES (?, ?, 'ACTIVE', ?, NOW(), NOW())`,
        [s.name, `${s.description} ${INTERNAL_TAG}`, s.kind],
      );
      id = res.insertId;
      pushId(manifest, 'specialties', id);
    }
    ctx.specialtyIds.set(s.key, id);
  }
  for (const s of SUBJECTS) {
    let id = await selectId(conn, `SELECT id_subjects AS id FROM subjects WHERE code = ?`, [s.code]);
    if (!id) {
      const [res] = await conn.query(
        `INSERT INTO subjects (name, code, status, created_at, updated_at) VALUES (?, ?, 'ACTIVE', NOW(), NOW())`,
        [s.name, s.code],
      );
      id = res.insertId;
      pushId(manifest, 'subjects', id);
    }
    ctx.subjectIds.set(s.code, id);
  }
  const [slots] = await conn.query(
    `SELECT id_schedule_time_slots AS id FROM schedule_time_slots WHERE slot_type = 'CLASS' AND is_active = 1 ORDER BY display_order LIMIT 6`,
  );
  ctx.slots = slots.map((r) => r.id);
  if (!ctx.slots.length) throw new Error('No hay franjas de clase en schedule_time_slots');
  log(`Catálogos listos (${SPECIALTIES.length} especialidades, ${SUBJECTS.length} materias).`);
}

async function seedSectionsAndGroups(conn, ctx, manifest, log) {
  const periodId = ctx.periodId;
  const plan = [
    { key: 's10', name: '10° Año — Jornada diurna', grade: 10, spec: null, groups: ['10-1', '10-2', '10-3'] },
    { key: 's11i', name: '11° Año — Informática', grade: 11, spec: 'info', groups: ['11-INFO-1', '11-INFO-2'] },
    { key: 's11c', name: '11° Año — Contabilidad', grade: 11, spec: 'conta', groups: ['11-CONT-1'] },
    { key: 's12e', name: '12° Año — Electricidad', grade: 12, spec: 'electro', groups: ['12-ELEC-1', '12-ELEC-2'] },
    { key: 's9t', name: '9° Año — Exploratorios', grade: 9, spec: 'robo', groups: ['9-ROB-1'] },
  ];
  for (const sec of plan) {
    let sectionId = await selectId(
      conn,
      `SELECT id_sections AS id FROM sections WHERE name = ? AND id_academic_periods = ?`,
      [sec.name, periodId],
    );
    if (!sectionId) {
      const specId = sec.spec ? ctx.specialtyIds.get(sec.spec) : null;
      const [res] = await conn.query(
        `INSERT INTO sections (name, grade_level, description, id_academic_periods, id_specialties, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'ACTIVE', NOW(), NOW())`,
        [sec.name, sec.grade, `Sección ${INTERNAL_TAG}`, periodId, specId],
      );
      sectionId = res.insertId;
      pushId(manifest, 'sections', sectionId);
    }
    ctx.sectionIds.set(sec.key, sectionId);
    for (const gName of sec.groups) {
      let groupId = await selectId(
        conn,
        `SELECT id_groups AS id FROM \`groups\` WHERE name = ? AND id_sections = ?`,
        [gName, sectionId],
      );
      if (!groupId) {
        const specId = sec.spec ? ctx.specialtyIds.get(sec.spec) : null;
        const [res] = await conn.query(
          `INSERT INTO \`groups\` (name, student_count, max_capacity, id_sections, id_specialties, id_academic_periods, status, created_at, updated_at)
           VALUES (?, 0, 35, ?, ?, ?, 'ACTIVE', NOW(), NOW())`,
          [gName, sectionId, specId, periodId],
        );
        groupId = res.insertId;
        pushId(manifest, 'groups', groupId);
      }
      ctx.groupIds.set(gName, groupId);
    }
  }
  log(`Estructura: ${plan.length} secciones, ${ctx.groupIds.size} grupos.`);
}

function resolveRoleId(ctx, roleName) {
  if (ctx.roleIds.has(roleName)) return ctx.roleIds.get(roleName);
  if (roleName === 'Encargado') {
    return ctx.roleIds.get('Padre de familia') ?? ctx.roleIds.get('Encargado');
  }
  return null;
}

async function seedUsers(conn, ctx, manifest, passwordHash, log) {
  const allUsers = [
    ...ctx.personas.teachers,
    ...ctx.personas.students,
    ...ctx.personas.guardians,
    ...ctx.personas.staff,
  ];
  for (const p of allUsers) {
    const [existing] = await conn.query(`SELECT id_users AS id, national_id FROM users WHERE national_id = ?`, [
      p.nationalId,
    ]);
    if (existing.length) {
      if (!String(existing[0].national_id).startsWith('801099')) {
        throw new Error(`Colisión: la cédula ${p.nationalId} pertenece a un usuario no sintético.`);
      }
      ctx.userIds.set(p.key, existing[0].id);
      continue;
    }
    const [emailHit] = await conn.query(`SELECT id_users AS id FROM users WHERE email = ?`, [p.email]);
    if (emailHit.length) throw new Error(`Colisión de correo: ${p.email}`);

    const demoLoginReady = /^(1|true|yes)$/i.test(String(process.env.PRESENTACION_DEMO_LOGIN_READY ?? '').trim());
    const mustChange = demoLoginReady ? 0 : 1;
    const [res] = await conn.query(
      `INSERT INTO users (national_id, name, first_lastname, second_lastname, email, password_hash, status, must_change_password, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, NOW(), NOW())`,
      [p.nationalId, p.name, p.firstLastname, p.secondLastname, p.email, passwordHash, mustChange],
    );
    const userId = res.insertId;
    ctx.userIds.set(p.key, userId);
    pushId(manifest, 'users', userId);
    pushId(manifest, 'nationalIds', p.nationalId);

    const roleId = resolveRoleId(ctx, p.role);
    if (!roleId) throw new Error(`Rol no encontrado: ${p.role}`);
    await insertIgnore(conn, `INSERT IGNORE INTO user_roles (id_users, id_roles, assigned_at) VALUES (?, ?, NOW())`, [
      userId,
      roleId,
    ]);
    pushId(manifest, 'user_roles', userId);
  }
  log(`Usuarios sintéticos: ${manifest.users.length} nuevos (sin actualizar existentes).`);
}

async function ensureTeaching(conn, ctx, manifest, userKey, groupName, periodId, payload) {
  const userId = ctx.userIds.get(userKey);
  const groupId = ctx.groupIds.get(groupName);
  const fp = `${userId}:${groupId}:${payload.offering_kind ?? ''}:${payload.subjectId ?? 0}:${payload.specialtyId ?? 0}:${periodId}`;
  let id = await selectId(conn, `SELECT id_teaching_assignments AS id FROM teaching_assignments WHERE assignment_fingerprint = ?`, [
    fp,
  ]);
  if (!id) {
    const [res] = await conn.query(
      `INSERT INTO teaching_assignments
        (id_users, id_groups, id_academic_periods, is_guide_teacher, offering_kind, id_subjects, id_specialties, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        userId,
        groupId,
        periodId,
        payload.guide ? 1 : 0,
        payload.offering_kind ?? null,
        payload.subjectId ?? null,
        payload.specialtyId ?? null,
      ],
    );
    id = res.insertId;
    pushId(manifest, 'teaching_assignments', id);
  }
  const mapKey = `${userKey}::${groupName}::${payload.label}`;
  ctx.teachingIds.set(mapKey, id);
  return id;
}

async function seedAssignmentsAndSchedule(conn, ctx, manifest, log) {
  const periodId = ctx.periodId;
  const assignments = [
    { user: 'doc_1', group: '10-1', label: 'guia', guide: true },
    { user: 'doc_1', group: '10-1', label: 'mat', offering_kind: 'SUBJECT', subjectId: ctx.subjectIds.get('MAT-10') },
    { user: 'doc_2', group: '10-2', label: 'guia', guide: true },
    { user: 'doc_2', group: '10-2', label: 'esp', offering_kind: 'SUBJECT', subjectId: ctx.subjectIds.get('ESP-10') },
    { user: 'doc_3', group: '11-INFO-1', label: 'guia', guide: true },
    { user: 'doc_3', group: '11-INFO-1', label: 'prog', offering_kind: 'SUBJECT', subjectId: ctx.subjectIds.get('PROG-11') },
    {
      user: 'doc_4',
      group: '11-INFO-1',
      label: 'tec',
      offering_kind: 'TECHNICAL_SPECIALTY',
      subjectId: ctx.subjectIds.get('PROG-11'),
      specialtyId: ctx.specialtyIds.get('info'),
    },
    { user: 'doc_5', group: '11-CONT-1', label: 'guia', guide: true },
    { user: 'doc_6', group: '12-ELEC-1', label: 'guia', guide: true },
    { user: 'doc_7', group: '9-ROB-1', label: 'taller', offering_kind: 'EXPLORATORY_WORKSHOP', specialtyId: ctx.specialtyIds.get('robo') },
  ];
  for (const a of assignments) {
    await ensureTeaching(conn, ctx, manifest, a.user, a.group, periodId, a);
  }

  let entryCount = 0;
  const dayPattern = [1, 3, 2, 4];
  for (const a of assignments.filter((x) => !x.guide)) {
    const taId = ctx.teachingIds.get(`${a.user}::${a.group}::${a.label}`);
    for (let i = 0; i < 2; i += 1) {
      const slotId = ctx.slots[i % ctx.slots.length];
      const day = dayPattern[(entryCount + i) % dayPattern.length];
      const exId = await selectId(
        conn,
        `SELECT id_schedule_entries AS id FROM schedule_entries WHERE id_teaching_assignments = ? AND id_schedule_time_slots = ? AND day_of_week = ?`,
        [taId, slotId, day],
      );
      if (!exId) {
        const [res] = await conn.query(
          `INSERT INTO schedule_entries (id_teaching_assignments, id_schedule_time_slots, day_of_week, created_at, updated_at)
           VALUES (?, ?, ?, NOW(), NOW())`,
          [taId, slotId, day],
        );
        pushId(manifest, 'schedule_entries', res.insertId);
        entryCount += 1;
      }
    }
  }
  log(`Asignaciones y horario: ${manifest.teaching_assignments.length} asignaciones, ${manifest.schedule_entries.length} entradas.`);
}

async function seedEnrollmentsAndLinks(conn, ctx, manifest, log) {
  const periodId = ctx.periodId;
  const groupNames = [...ctx.groupIds.keys()];
  const students = ctx.personas.students;
  for (let i = 0; i < students.length; i += 1) {
    const stu = students[i];
    const groupName = groupNames[i % groupNames.length];
    const userId = ctx.userIds.get(stu.key);
    const groupId = ctx.groupIds.get(groupName);
    const ex = await selectId(
      conn,
      `SELECT id_group_enrollments AS id FROM group_enrollments WHERE id_users = ? AND id_groups = ? AND status = 'ACTIVE'`,
      [userId, groupId],
    );
    if (!ex) {
      const [res] = await conn.query(
        `INSERT INTO group_enrollments (id_users, id_groups, id_academic_periods, starts_on, status, created_at, updated_at)
         VALUES (?, ?, ?, '2026-02-02', 'ACTIVE', NOW(), NOW())`,
        [userId, groupId, periodId],
      );
      pushId(manifest, 'group_enrollments', res.insertId);
    }
  }

  for (let i = 0; i < ctx.personas.guardians.length; i += 1) {
    const g = ctx.personas.guardians[i];
    const s = students[i % students.length];
    const gId = ctx.userIds.get(g.key);
    const sId = ctx.userIds.get(s.key);
    const linkId = await selectId(
      conn,
      `SELECT id_guardian_student_links AS id FROM guardian_student_links WHERE id_users_guardian = ? AND id_users_student = ?`,
      [gId, sId],
    );
    if (!linkId) {
      const [res] = await conn.query(
        `INSERT INTO guardian_student_links (id_users_guardian, id_users_student, relationship, created_at)
         VALUES (?, ?, 'MOTHER', NOW())`,
        [gId, sId],
      );
      pushId(manifest, 'guardian_student_links', res.insertId);
    }
  }
  log('Matrículas y vínculos familiares listos.');
}

async function seedAttendance(conn, ctx, manifest, log) {
  const taId = ctx.teachingIds.get('doc_1::10-1::mat');
  const entryId = await selectId(
    conn,
    `SELECT id_schedule_entries AS id FROM schedule_entries WHERE id_teaching_assignments = ? LIMIT 1`,
    [taId],
  );
  const docId = ctx.userIds.get('doc_1');
  const sessionDates = ['2026-02-10', '2026-02-11', '2026-02-12', '2026-03-03'];
  const sessionIds = [];
  for (const sessionDate of sessionDates) {
    let sid = await selectId(
      conn,
      `SELECT id_attendance_sessions AS id FROM attendance_sessions WHERE id_teaching_assignments = ? AND session_date = ?`,
      [taId, sessionDate],
    );
    if (!sid) {
      const [res] = await conn.query(
        `INSERT INTO attendance_sessions (id_teaching_assignments, id_schedule_entries, session_date, started_at, closed_at, status, id_users_created_by, created_at, updated_at)
         VALUES (?, ?, ?, NOW(), NOW(), 'CLOSED', ?, NOW(), NOW())`,
        [taId, entryId, sessionDate, docId],
      );
      sid = res.insertId;
      pushId(manifest, 'attendance_sessions', sid);
    }
    sessionIds.push(sid);
  }

  const students = ctx.personas.students.slice(0, 12);
  const statuses = ['PRESENT', 'PRESENT', 'LATE', 'ABSENT'];
  for (const sid of sessionIds) {
    for (let i = 0; i < students.length; i += 1) {
      const stuId = ctx.userIds.get(students[i].key);
      const status = statuses[(i + sid) % statuses.length];
      let just = 'NONE';
      if (status === 'ABSENT' && i % 3 === 1) just = 'PENDING';
      if (status === 'ABSENT' && i % 3 === 2) just = 'JUSTIFIED';
      const existing = await selectId(
        conn,
        `SELECT id_attendance AS id FROM attendance WHERE id_attendance_sessions = ? AND id_users_student = ?`,
        [sid, stuId],
      );
      if (existing) continue;
      const [res] = await conn.query(
        `INSERT INTO attendance (id_attendance_sessions, id_users_student, status, justification_status, registration_method, registered_at, id_users_registered_by, updated_at)
         VALUES (?, ?, ?, ?, 'MANUAL', NOW(), ?, NOW())`,
        [sid, stuId, status, just, docId],
      );
      pushId(manifest, 'attendance', res.insertId);
      if (just === 'PENDING' || just === 'JUSTIFIED') {
        const jStatus = just === 'JUSTIFIED' ? 'APPROVED' : 'PENDING';
        const [jRes] = await conn.query(
          `INSERT INTO absence_justifications (id_attendance, reason, status, id_users_reviewed_by, reviewed_at, id_users_created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [
            res.insertId,
            `Motivo de ausencia — ${INTERNAL_TAG}`,
            jStatus,
            jStatus === 'APPROVED' ? docId : null,
            jStatus === 'APPROVED' ? new Date() : null,
            stuId,
          ],
        );
        pushId(manifest, 'absence_justifications', jRes.insertId);
      }
    }
  }

  const riskStudent = ctx.userIds.get('est_5');
  const groupId = ctx.groupIds.get('10-1');
  const idem = `${IDEMPOTENCY_PREFIX}alert_est5_2026`;
  const alertEx = await selectId(conn, `SELECT id_absenteeism_alerts AS id FROM absenteeism_alerts WHERE idempotency_key = ?`, [
    idem,
  ]);
  if (!alertEx) {
    const [res] = await conn.query(
      `INSERT INTO absenteeism_alerts (id_users_student, id_groups, risk_level, status, rule_codes, unjustified_absences_month, absences_period, consecutive_absences, attendance_percent, window_start, window_end, idempotency_key, triggered_at, updated_at)
       VALUES (?, ?, 'MEDIUM', 'NEW', ?, 3, 5, 2, 82.5, '2026-02-01', '2026-03-31', ?, NOW(), NOW())`,
      [riskStudent, groupId, JSON.stringify(['CONSECUTIVE_ABSENCES']), idem],
    );
    pushId(manifest, 'absenteeism_alerts', res.insertId);
    const [nRes] = await conn.query(
      `INSERT INTO absenteeism_alert_notifications (id_absenteeism_alerts, channel, title, body, sent_at)
       VALUES (?, 'IN_APP', 'Seguimiento de asistencia', 'El estudiante acumula ausencias sin justificar en el periodo.', NOW())`,
      [res.insertId],
    );
    pushId(manifest, 'absenteeism_alert_notifications', nRes.insertId);
  }
  log('Asistencia, justificaciones y alertas listas.');
}

async function nextCaseNumber(conn, year) {
  await conn.query(
    `INSERT INTO disciplinary_case_sequences (\`year\`, last_value) VALUES (?, 0) ON DUPLICATE KEY UPDATE last_value = last_value`,
    [year],
  );
  const [rows] = await conn.query(
    `SELECT last_value AS v FROM disciplinary_case_sequences WHERE year = ? FOR UPDATE`,
    [year],
  );
  const next = Number(rows[0].v) + 1;
  await conn.query(`UPDATE disciplinary_case_sequences SET last_value = ? WHERE year = ?`, [next, year]);
  return `AM-${year}-${String(next).padStart(4, '0')}`;
}

async function ensureInfraction(conn, manifest, name, severity, legal) {
  let id = await selectId(conn, `SELECT id_disciplinary_infraction_types AS id FROM disciplinary_infraction_types WHERE name = ?`, [
    name,
  ]);
  if (!id) {
    const [res] = await conn.query(
      `INSERT INTO disciplinary_infraction_types (name, description, severity, legal_reference, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, NOW(), NOW())`,
      [name, `${INTERNAL_TAG}`, severity, legal],
    );
    id = res.insertId;
    pushId(manifest, 'disciplinary_infraction_types', id);
  }
  return id;
}

async function seedDiscipline(conn, ctx, manifest, log) {
  const infMinor = await ensureInfraction(conn, manifest, 'Uso indebido del uniforme', 'MINOR', 'Art. 154 REAC');
  const infSerious = await ensureInfraction(conn, manifest, 'Alteración del orden en clase', 'SERIOUS', 'Art. 155 REAC');
  const studentId = ctx.userIds.get('est_8');
  const groupId = ctx.groupIds.get('10-1');
  const reporterId = ctx.userIds.get('doc_1');
  const orientId = ctx.userIds.get('orientador');
  const guardianId = ctx.userIds.get('enc_3');
  const periodId = ctx.periodId;
  const year = 2026;

  const cases = [
    { status: 'REPORTED', track: 'DIRECT', severity: 'MINOR', typeId: infMinor, student: 'est_3' },
    { status: 'INVESTIGATING', track: 'DUE_PROCESS', severity: 'SERIOUS', typeId: infSerious, student: 'est_8' },
    { status: 'RESOLVED', track: 'DUE_PROCESS', severity: 'MINOR', typeId: infMinor, student: 'est_12', outcome: 'UPHOLD' },
    { status: 'IN_APPEAL', track: 'DUE_PROCESS', severity: 'SERIOUS', typeId: infSerious, student: 'est_15' },
    { status: 'FIRM', track: 'DIRECT', severity: 'VERY_MINOR', typeId: infMinor, student: 'est_20' },
    { status: 'PENDING_RESOLUTION', track: 'DUE_PROCESS', severity: 'SERIOUS', typeId: infSerious, student: 'est_22' },
  ];

  const caseIds = [];
  for (const c of cases) {
    const stuId = ctx.userIds.get(c.student);
    const ex = await selectId(
      conn,
      `SELECT id_disciplinary_cases AS id FROM disciplinary_cases WHERE id_users_student = ? AND id_academic_periods = ? AND status = ? AND description LIKE ?`,
      [stuId, periodId, c.status, `%${INTERNAL_TAG}%`],
    );
    if (ex) {
      caseIds.push(ex);
      continue;
    }
    const caseNumber = await nextCaseNumber(conn, year);
    const [res] = await conn.query(
      `INSERT INTO disciplinary_cases
        (case_number, id_users_student, id_groups, id_academic_periods, id_disciplinary_infraction_types, original_severity, severity, track, status,
         occurred_at, place, description, id_users_reporter, id_users_responsible, step_started_on, step_business_days, resolution_outcome, firm_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '2026-02-15 09:30:00', 'Aula 10-1', ?, ?, ?, '2026-02-15', 5, ?, ?, NOW(), NOW())`,
      [
        caseNumber,
        stuId,
        groupId,
        periodId,
        c.typeId,
        c.severity,
        c.severity,
        c.track,
        c.status,
        `Hecho reportado en el contexto escolar (${INTERNAL_TAG})`,
        reporterId,
        orientId,
        c.outcome ?? null,
        c.status === 'FIRM' ? new Date() : null,
      ],
    );
    pushId(manifest, 'disciplinary_cases', res.insertId);
    caseIds.push(res.insertId);

    const [ev] = await conn.query(
      `INSERT INTO disciplinary_communications (id_disciplinary_cases, kind, body, id_users_issuer, issued_at, delivery_medium, created_at)
       VALUES (?, 'FORMAL_CHARGE', ?, ?, NOW(), 'IN_PERSON', NOW())`,
      [res.insertId, 'Comunicación formal del proceso disciplinario.', orientId],
    );
    pushId(manifest, 'disciplinary_communications', ev.insertId);

    const [notif] = await conn.query(
      `INSERT INTO disciplinary_notifications (id_disciplinary_communications, id_users_guardian, email_status, read_at, created_at)
       VALUES (?, ?, 'SKIPPED', NULL, NOW())`,
      [ev.insertId, guardianId],
    );
    pushId(manifest, 'disciplinary_notifications', notif.insertId);
  }

  const appealCaseId = caseIds.find((_, idx) => cases[idx].status === 'IN_APPEAL');
  if (appealCaseId) {
    const [ap] = await conn.query(
      `INSERT INTO disciplinary_appeals (id_disciplinary_cases, kind, is_subsidiary, body, filed_at, id_users_filed_by, outcome, id_users_resolver, resolved_at, created_at)
       VALUES (?, 'APPEAL', 0, 'Solicitud de revisión de la sanción impuesta.', '2026-03-01 10:00:00', ?, NULL, NULL, NULL, NOW())`,
      [appealCaseId, guardianId],
    );
    pushId(manifest, 'disciplinary_appeals', ap.insertId);
  }
  const firmCase = caseIds.find((_, idx) => cases[idx].status === 'FIRM');
  if (firmCase) {
    const [rev] = await conn.query(
      `INSERT INTO disciplinary_appeals (id_disciplinary_cases, kind, is_subsidiary, body, filed_at, id_users_filed_by, outcome, reasoning, id_users_resolver, resolved_at, created_at)
       VALUES (?, 'REVOCATION', 0, 'Solicitud de revocatoria.', '2026-01-20 11:00:00', ?, 'UPHOLD', 'Se confirma la medida.', ?, '2026-01-28 16:00:00', NOW())`,
      [firmCase, guardianId, orientId],
    );
    pushId(manifest, 'disciplinary_appeals', rev.insertId);
    const [def] = await conn.query(
      `INSERT INTO disciplinary_defenses (id_disciplinary_cases, body, channel, id_users_presented_by, presented_at, created_at)
       VALUES (?, 'Descargos presentados por la familia.', 'PORTAL', ?, '2026-02-05 12:00:00', NOW())`,
      [firmCase, guardianId],
    );
    pushId(manifest, 'disciplinary_defenses', def.insertId);
  }
  log(`Disciplina: ${manifest.disciplinary_cases.length} expedientes.`);
}

async function seedCommunications(conn, ctx, manifest, log) {
  const authorId = ctx.userIds.get('director');
  const comms = [
    {
      title: 'Calendario de actividades institucionales — marzo 2026',
      priority: 'IMPORTANT',
      status: 'PUBLISHED',
      ack: 1,
      recipient: 'ALL',
    },
    {
      title: 'Jornada de orientación vocacional para tercer ciclo',
      priority: 'NORMAL',
      status: 'PUBLISHED',
      ack: 0,
      recipient: 'ALL',
    },
    {
      title: 'Recordatorio: uso del uniforme y convivencia',
      priority: 'URGENT',
      status: 'PUBLISHED',
      ack: 1,
      recipient: 'ROLE',
      target: 'Padre de familia',
    },
    {
      title: 'Actualización de horarios de talleres exploratorios',
      priority: 'NORMAL',
      status: 'PUBLISHED',
      ack: 0,
      recipient: 'GROUP',
      target: '9-ROB-1',
    },
    { title: 'Borrador: feria de innovación estudiantil', priority: 'NORMAL', status: 'DRAFT', ack: 0, recipient: 'ALL' },
    {
      title: 'Circular interna para docentes guía',
      priority: 'IMPORTANT',
      status: 'PUBLISHED',
      ack: 0,
      recipient: 'ROLE',
      target: 'Docente',
    },
  ];

  for (const c of comms) {
    const id = randomUUID();
    const ex = await selectId(conn, `SELECT id FROM communications WHERE title = ?`, [c.title]);
    if (ex) continue;
    await conn.query(
      `INSERT INTO communications (id, title, content, priority, status, requires_acknowledgment, publish_date, author_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, NOW(), NOW())`,
      [id, c.title, `Contenido institucional del CTP Hojancha. ${INTERNAL_TAG}`, c.priority, c.status, c.ack, authorId],
    );
    pushId(manifest, 'communications', id);
    const rid = randomUUID();
    let targetId = null;
    if (c.recipient === 'GROUP') targetId = String(ctx.groupIds.get(c.target));
    if (c.recipient === 'ROLE') targetId = c.target;
    await conn.query(
      `INSERT INTO communication_recipients (id, communication_id, recipient_type, target_id, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [rid, id, c.recipient, targetId],
    );
    pushId(manifest, 'communication_recipients', rid);
    if (c.ack && c.status === 'PUBLISHED') {
      const reader = ctx.userIds.get('enc_1');
      const readId = randomUUID();
      await conn.query(
        `INSERT INTO communication_reads (id, communication_id, user_id, read_at, acknowledged_at)
         VALUES (?, ?, ?, NOW(), NOW())`,
        [readId, id, reader],
      );
      pushId(manifest, 'communication_reads', readId);
    }
  }
  log(`Comunicados: ${manifest.communications.length} registros.`);
}

async function seedDepartures(conn, ctx, manifest, log) {
  const guardId = ctx.userIds.get('guarda');
  const directorId = ctx.userIds.get('director');
  const studentId = ctx.userIds.get('est_1');
  const guardianId = ctx.userIds.get('enc_1');
  const permitId = randomUUID();
  const permitEx = await selectId(conn, `SELECT id FROM scheduled_departure_permits WHERE id = ?`, [permitId]);
  if (!permitEx) {
    await conn.query(
      `INSERT INTO scheduled_departure_permits (id, student_id, authorized_by_id, permit_date, departure_time, reason, status, created_at)
       VALUES (?, ?, ?, '2026-03-15', '14:30:00', ?, 'PENDING', NOW())`,
      [permitId, studentId, directorId, `Salida autorizada por dirección (${INTERNAL_TAG})`],
    );
    pushId(manifest, 'scheduled_departure_permits', permitId);
  }

  for (let i = 0; i < 4; i += 1) {
    const stu = ctx.userIds.get(ctx.personas.students[i].key);
    const enc = ctx.userIds.get(ctx.personas.guardians[i].key);
    const reason = `Registro de salida autorizada (${INTERNAL_TAG})`;
    const existingDep = await selectId(
      conn,
      `SELECT id FROM student_departures WHERE student_id = ? AND justification_reason = ?`,
      [stu, reason],
    );
    if (existingDep) {
      pushId(manifest, 'student_departures', existingDep);
      continue;
    }
    const depId = randomUUID();
    const [encRow] = await conn.query(`SELECT national_id AS nid FROM users WHERE id_users = ?`, [enc]);
    const [res] = await conn.query(
      `INSERT INTO student_departures (id, student_id, guardian_id, guardian_identifier, relationship, security_guard_id, scheduled_permit_id, departure_time, status, departure_type, justification_reason, created_at)
       VALUES (?, ?, ?, ?, 'MOTHER', ?, ?, NOW(), 'AUTHORIZED', 'REGULAR', ?, NOW())`,
      [
        depId,
        stu,
        enc,
        encRow[0]?.nid ?? null,
        guardId,
        i === 0 ? permitId : null,
        `Registro de salida autorizada (${INTERNAL_TAG})`,
      ],
    );
    if (res.affectedRows) pushId(manifest, 'student_departures', depId);
  }
  log('Salidas y permisos registrados.');
}

async function refreshGroupCounts(conn, groupIds, log) {
  for (const gid of groupIds.values()) {
    await conn.query(
      `UPDATE \`groups\` g SET student_count = (
         SELECT COUNT(*) FROM group_enrollments e WHERE e.id_groups = g.id_groups AND e.status = 'ACTIVE'
       ) WHERE g.id_groups = ?`,
      [gid],
    );
  }
  log('Contadores de estudiantes en grupos actualizados.');
}
