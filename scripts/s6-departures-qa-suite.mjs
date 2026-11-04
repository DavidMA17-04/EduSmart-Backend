/**
 * QA del módulo de Control de Salidas (migración 032) — nivel API contra Nest + MySQL locales.
 *
 *   node scripts/s6-departures-qa-suite.mjs
 *
 * Requisitos: backend encendido, migración 032 aplicada y `npm run db:seed:demo`
 * (usuarios 3000000xx, contraseña TempPass12) en la base de DB_DATABASE.
 *
 * ESCRIBE DATOS DE PRUEBA (salidas, permisos, un director y un orientador QA).
 * Por seguridad solo corre en bases cuyo nombre contenga "qa", "test" o "fresh",
 * salvo que se pase --allow-any-db.
 */
import bcrypt from 'bcrypt';
import ExcelJS from 'exceljs';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(scriptDir, '..', '.env'), quiet: true });

const BASE = `http://127.0.0.1:${process.env.PORT || 3000}/api/v1`;
const PASSWORD = process.env.DEPQA_PASSWORD || 'TempPass12';
const DB_NAME = process.env.DB_DATABASE || 'EduSmart';

const IDS = {
  admin: {
    identifier: process.env.ADMIN_NATIONAL_ID || '100000000',
    password: process.env.ADMIN_PASSWORD || 'Admin1234',
  },
  teacher: '300000010',
  teacher2: '300000011',
  diego: '300000020', // vinculado a Roberto
  laura: '300000021', // sin encargado vinculado
  kevin: '300000022', // vinculado a Roberto
  guardian: '300000030',
  guard: '300000040',
  director: '300000050', // creado por esta suite
  counselor: '300000051', // creado por esta suite
};

const results = [];
function record(id, ok, detail = '') {
  results.push({ id, ok, detail });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id}${detail ? ' — ' + detail : ''}`);
}
function check(id, condition, detail = '') {
  record(id, Boolean(condition), condition ? '' : detail);
}

async function api(method, pathName, { token, body, raw } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${pathName}`, { method, headers, body: payload });
  if (raw) return { res, buffer: Buffer.from(await res.arrayBuffer()) };
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { res, json, data: json?.data };
}

const msg = (json) =>
  Array.isArray(json?.message) ? json.message.join(' | ') : String(json?.message ?? '');

async function login(identifier, password = PASSWORD) {
  const { res, data, json } = await api('POST', '/auth/login', { body: { identifier, password } });
  if (!res.ok) throw new Error(`login ${identifier} → ${res.status} ${msg(json)}`);
  return data;
}

/** Fecha calendario de Costa Rica (UTC-6, sin horario de verano). */
function crDate(offsetDays = 0, now = new Date()) {
  const d = new Date(now.getTime() - 6 * 3600_000 + offsetDays * 86400_000);
  return d.toISOString().slice(0, 10);
}

async function ensureUser(db, nationalId, name, roleName) {
  const [rows] = await db.query('SELECT id_users FROM users WHERE national_id = ?', [nationalId]);
  let id = rows[0]?.id_users;
  if (!id) {
    const hash = await bcrypt.hash(PASSWORD, 10);
    const [r] = await db.query(
      `INSERT INTO users (national_id, name, first_lastname, email, password_hash, status, must_change_password)
       VALUES (?, ?, 'QA', ?, ?, 'ACTIVE', 0)`,
      [nationalId, name, `qa-${nationalId}@edusmart.test`, hash],
    );
    id = r.insertId;
  }
  await db.query(
    `INSERT INTO user_roles (id_users, id_roles, assigned_at)
     SELECT ?, id_roles, NOW() FROM roles WHERE name = ?
       AND NOT EXISTS (SELECT 1 FROM user_roles ur JOIN roles r2 ON r2.id_roles = ur.id_roles WHERE ur.id_users = ? AND r2.name = ?)`,
    [id, roleName, id, roleName],
  );
  return id;
}

async function main() {
  if (!/qa|test|fresh/i.test(DB_NAME) && !process.argv.includes('--allow-any-db')) {
    console.error(
      `La base "${DB_NAME}" no parece de pruebas. Esta suite escribe datos. Use una base QA o --allow-any-db.`,
    );
    process.exit(2);
  }
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD,
    database: DB_NAME,
    charset: 'utf8mb4',
  });

  // Datos base: se limpia lo que esta suite pudo dejar de corridas previas.
  await db.query('DELETE FROM student_departures');
  await db.query('DELETE FROM scheduled_departure_permits');
  await ensureUser(db, IDS.director, 'Directora', 'Director');
  await ensureUser(db, IDS.counselor, 'Orientador', 'Orientador');
  const userId = async (nid) =>
    (await db.query('SELECT id_users FROM users WHERE national_id = ?', [nid]))[0][0].id_users;
  const diegoId = await userId(IDS.diego);
  const kevinId = await userId(IDS.kevin);

  // ── A. Autenticación, roles y permisos ─────────────────────────────────────
  const sessions = {};
  for (const [key, id] of Object.entries(IDS)) {
    if (key === 'admin') sessions.admin = await login(id.identifier, id.password);
    else if (['teacher', 'diego', 'guardian', 'guard', 'director', 'counselor'].includes(key))
      sessions[key] = await login(id);
  }
  const T = Object.fromEntries(Object.entries(sessions).map(([k, s]) => [k, s.accessToken]));
  const perms = (k) =>
    sessions[k].user.permissions.filter((p) => p.startsWith('departures.')).sort();

  check(
    'A01 guarda: 4 permisos de salidas, sin manage_permits',
    JSON.stringify(perms('guard')) ===
      JSON.stringify([
        'departures.create',
        'departures.export',
        'departures.validate',
        'departures.view_history',
      ]),
    perms('guard').join(','),
  );
  check('A02 admin: 5 permisos de salidas', perms('admin').length === 5, perms('admin').join(','));
  check(
    'A03 director: 5 permisos de salidas',
    perms('director').length === 5,
    perms('director').join(','),
  );
  check(
    'A04 docente/estudiante/encargado/orientador sin permisos de salidas',
    ['teacher', 'diego', 'guardian', 'counselor'].every((k) => perms(k).length === 0),
  );

  const today = crDate();
  const endpoints = [
    [
      'POST',
      '/student-departures/validate-guardian',
      { studentIdentifier: IDS.diego, guardianIdentifier: IDS.guardian },
    ],
    [
      'POST',
      '/student-departures',
      { studentIdentifier: IDS.diego, guardianIdentifier: IDS.guardian },
    ],
    ['GET', '/student-departures/today-kpis'],
    ['GET', '/student-departures/history'],
    ['GET', '/student-departures/groups'],
    ['GET', '/student-departures/export/excel'],
    ['GET', '/student-departures/export/pdf'],
    ['GET', '/scheduled-permits/today'],
    ['GET', '/scheduled-permits'],
    [
      'POST',
      '/scheduled-permits',
      { studentIdentifier: IDS.diego, permitDate: today, departureTime: '13:00', reason: 'QA' },
    ],
    ['PATCH', '/scheduled-permits/00000000-0000-0000-0000-000000000000/complete'],
  ];
  {
    const noAuth = [];
    for (const [m, p, b] of endpoints) {
      const { res } = await api(m, p, { body: b });
      if (res.status !== 401) noAuth.push(`${m} ${p}=${res.status}`);
    }
    check('A05 sin token → 401 en los 11 endpoints', noAuth.length === 0, noAuth.join('; '));
  }
  for (const role of ['diego', 'teacher', 'guardian', 'counselor']) {
    const bad = [];
    for (const [m, p, b] of endpoints) {
      const { res } = await api(m, p, { token: T[role], body: b });
      if (res.status !== 403) bad.push(`${m} ${p}=${res.status}`);
    }
    check(`A06 ${role} → 403 en los 11 endpoints`, bad.length === 0, bad.join('; '));
  }
  {
    const [rows] = await db.query('SELECT COUNT(*) n FROM student_departures');
    check(
      'A07 los intentos 401/403 no escribieron registros',
      Number(rows[0].n) === 0,
      `filas=${rows[0].n}`,
    );
  }

  // ── B. Validación del encargado ────────────────────────────────────────────
  {
    const { res, data } = await api('POST', '/student-departures/validate-guardian', {
      token: T.guard,
      body: { studentIdentifier: '3-0000-0020', guardianIdentifier: ' 300000030 ' },
    });
    check(
      'B01 encargado vinculado (cédula con guiones/espacios) → autorizado',
      res.status === 200 || res.status === 201,
      `status=${res.status}`,
    );
    check(
      'B02 respuesta trae estudiante, sección y parentesco legible',
      data?.authorized === true &&
        data?.student?.fullName?.includes('Diego') &&
        data?.student?.groupName &&
        data?.guardian?.relationship === 'Padre',
      JSON.stringify({
        authorized: data?.authorized,
        g: data?.guardian,
        s: data?.student?.groupName,
      }),
    );
    const masked = (data?.registeredGuardians ?? []).every(
      (g) => !String(g.nationalIdMasked ?? g.nationalId ?? '').includes('300000030'),
    );
    check(
      'B03 cédulas de tutores enmascaradas en la respuesta',
      masked && (data?.registeredGuardians ?? []).length >= 1,
      JSON.stringify(data?.registeredGuardians),
    );
    check('B04 validación exitosa no escribe en la bitácora', data?.rejectionId == null);
  }
  {
    const { data } = await api('POST', '/student-departures/validate-guardian', {
      token: T.guard,
      body: { studentIdentifier: IDS.diego, guardianIdentifier: IDS.teacher2 },
    });
    check(
      'B05 encargado no vinculado → authorized=false + mensaje oficial',
      data?.authorized === false && /no coincide con los tutores legales/.test(data?.message ?? ''),
      JSON.stringify(data?.message),
    );
    const [rows] = await db.query(
      'SELECT status, guardian_identifier, security_guard_id FROM student_departures WHERE id = ?',
      [data?.rejectionId ?? ''],
    );
    check(
      'B06 rechazo registrado en bitácora (REJECTED, cédula presentada)',
      rows[0]?.status === 'REJECTED' && rows[0]?.guardian_identifier === IDS.teacher2,
      JSON.stringify(rows[0]),
    );
    const [audit] = await db.query(
      'SELECT action, actor_id, `after` FROM audit_logs WHERE entity_id = ?',
      [data?.rejectionId ?? ''],
    );
    check(
      'B07 rechazo registrado en auditoría con actor e IP',
      audit.length === 1 &&
        audit[0].actor_id === sessions.guard.user.id &&
        JSON.stringify(audit[0].after).includes('ip'),
      JSON.stringify(audit[0]),
    );
  }
  {
    const { data } = await api('POST', '/student-departures/validate-guardian', {
      token: T.guard,
      body: { studentIdentifier: IDS.laura, guardianIdentifier: IDS.guardian },
    });
    check(
      'B08 estudiante sin tutores vinculados → authorized=false',
      data?.authorized === false && (data?.registeredGuardians ?? []).length === 0,
    );
  }
  {
    const r1 = await api('POST', '/student-departures/validate-guardian', {
      token: T.guard,
      body: { studentIdentifier: '999999999', guardianIdentifier: IDS.guardian },
    });
    check(
      'B09 estudiante inexistente → 404 en español',
      r1.res.status === 404 && /estudiante activo/.test(msg(r1.json)),
      `${r1.res.status} ${msg(r1.json)}`,
    );
    const r2 = await api('POST', '/student-departures/validate-guardian', {
      token: T.guard,
      body: { studentIdentifier: IDS.teacher, guardianIdentifier: IDS.guardian },
    });
    check(
      'B10 cédula de un docente como estudiante → 404',
      r2.res.status === 404,
      `${r2.res.status}`,
    );
    const r3 = await api('POST', '/student-departures/validate-guardian', {
      token: T.guard,
      body: { studentIdentifier: '', guardianIdentifier: '' },
    });
    check(
      'B11 campos vacíos → 400 con mensajes en español',
      r3.res.status === 400 && /Ingrese la cédula/.test(msg(r3.json)),
      `${r3.res.status} ${msg(r3.json)}`,
    );
    const r4 = await api('POST', '/student-departures/validate-guardian', {
      token: T.guard,
      body: { studentIdentifier: IDS.diego, guardianIdentifier: IDS.guardian, extra: 1 },
    });
    check('B12 campos extra rechazados (whitelist)', r4.res.status === 400, `${r4.res.status}`);
  }
  {
    await db.query("UPDATE users SET status = 'INACTIVE' WHERE national_id = ?", [IDS.kevin]);
    const r = await api('POST', '/student-departures/validate-guardian', {
      token: T.guard,
      body: { studentIdentifier: IDS.kevin, guardianIdentifier: IDS.guardian },
    });
    await db.query("UPDATE users SET status = 'ACTIVE' WHERE national_id = ?", [IDS.kevin]);
    check('B13 estudiante inactivo → 404', r.res.status === 404, `${r.res.status}`);
  }
  {
    await db.query("UPDATE users SET status = 'INACTIVE' WHERE national_id = ?", [IDS.guardian]);
    const { data } = await api('POST', '/student-departures/validate-guardian', {
      token: T.guard,
      body: { studentIdentifier: IDS.kevin, guardianIdentifier: IDS.guardian },
    });
    await db.query("UPDATE users SET status = 'ACTIVE' WHERE national_id = ?", [IDS.guardian]);
    check(
      'B14 encargado vinculado pero inactivo → authorized=false',
      data?.authorized === false,
      JSON.stringify({ authorized: data?.authorized }),
    );
  }

  // ── C. Registro de salidas ─────────────────────────────────────────────────
  let firstDepartureId;
  let manualRejectionId;
  {
    const { res, data } = await api('POST', '/student-departures', {
      token: T.guard,
      body: { studentIdentifier: IDS.diego, guardianIdentifier: IDS.guardian },
    });
    firstDepartureId = data?.id;
    check(
      'C01 salida regular autorizada → 201',
      res.status === 201 && data?.status === 'AUTHORIZED',
      `${res.status} ${JSON.stringify(data)}`,
    );
    const [rows] = await db.query(
      'SELECT departure_type, security_guard_id, guardian_id, relationship, TIMESTAMPDIFF(SECOND, departure_time, UTC_TIMESTAMP()) AS age FROM student_departures WHERE id = ?',
      [data?.id ?? ''],
    );
    check(
      'C02 guarda, encargado, parentesco y hora del servidor guardados',
      rows[0]?.departure_type === 'REGULAR' &&
        rows[0]?.security_guard_id === sessions.guard.user.id &&
        rows[0]?.guardian_id &&
        Math.abs(rows[0]?.age) < 60,
      JSON.stringify(rows[0]),
    );
  }
  {
    const { res, json } = await api('POST', '/student-departures', {
      token: T.guard,
      body: {
        studentIdentifier: IDS.diego,
        guardianIdentifier: IDS.guardian,
        securityGuardId: 1,
        departureTime: '2020-01-01T00:00:00Z',
      },
    });
    check(
      'C03 no se puede suplantar guarda ni hora (campos rechazados)',
      res.status === 400,
      `${res.status} ${msg(json)}`,
    );
  }
  {
    const before = (
      await db.query("SELECT COUNT(*) n FROM student_departures WHERE status='REJECTED'")
    )[0][0].n;
    const { res, json } = await api('POST', '/student-departures', {
      token: T.guard,
      body: { studentIdentifier: IDS.kevin, guardianIdentifier: IDS.teacher2 },
    });
    const after = (
      await db.query("SELECT COUNT(*) n FROM student_departures WHERE status='REJECTED'")
    )[0][0].n;
    check(
      'C04 registrar con encargado no vinculado → 422 y queda el rechazo',
      res.status === 422 && Number(after) === Number(before) + 1,
      `${res.status} ${msg(json)} rechazos ${before}→${after}`,
    );
    const authorized = (
      await db.query(
        "SELECT COUNT(*) n FROM student_departures WHERE status='AUTHORIZED' AND student_id = ?",
        [kevinId],
      )
    )[0][0].n;
    check('C05 el intento forzado NO autoriza la salida', Number(authorized) === 0);
  }
  {
    const r1 = await api('POST', '/student-departures', {
      token: T.guard,
      body: {
        studentIdentifier: IDS.kevin,
        guardianIdentifier: IDS.guardian,
        departureType: 'EMERGENCY',
      },
    });
    check(
      'C06 emergencia sin motivo → 400 con un solo mensaje en español',
      r1.res.status === 400 && /motivo/i.test(msg(r1.json)) && !/must|should/.test(msg(r1.json)),
      `${r1.res.status} ${msg(r1.json)}`,
    );
    const r2 = await api('POST', '/student-departures', {
      token: T.guard,
      body: {
        studentIdentifier: IDS.kevin,
        guardianIdentifier: IDS.guardian,
        departureType: 'EMERGENCY',
        justificationReason: 'abc',
      },
    });
    check('C07 motivo de menos de 5 caracteres → 400', r2.res.status === 400, `${r2.res.status}`);
    const r3 = await api('POST', '/student-departures', {
      token: T.guard,
      body: {
        studentIdentifier: IDS.kevin,
        guardianIdentifier: IDS.guardian,
        departureType: 'EMERGENCY',
        justificationReason: 'Fiebre alta, lo recoge el padre',
      },
    });
    check(
      'C08 emergencia con motivo → 201',
      r3.res.status === 201 && r3.data?.status === 'AUTHORIZED',
      `${r3.res.status}`,
    );
  }
  {
    const r = await api('POST', '/student-departures', {
      token: T.guard,
      body: {
        studentIdentifier: IDS.diego,
        guardianIdentifier: IDS.guardian,
        decision: 'REJECTED',
        justificationReason: 'Encargado en estado inconveniente',
      },
    });
    manualRejectionId = r.data?.id;
    const [rows] = await db.query(
      'SELECT status, justification_reason, guardian_id, relationship FROM student_departures WHERE id = ?',
      [r.data?.id ?? ''],
    );
    check(
      'C09 rechazo manual del guarda con motivo → REJECTED',
      r.res.status === 201 && rows[0]?.status === 'REJECTED',
      `${r.res.status} ${JSON.stringify(rows[0])}`,
    );
    check(
      'C09b rechazo manual de un encargado vinculado conserva encargado y parentesco',
      rows[0]?.guardian_id && rows[0]?.relationship === 'Padre',
      JSON.stringify(rows[0]),
    );
    const [audit] = await db.query('SELECT action FROM audit_logs WHERE entity_id = ?', [
      r.data?.id ?? '',
    ]);
    check(
      'C09c auditoría distingue rechazo manual de encargado no coincidente',
      audit[0]?.action === 'DEPARTURE_MANUAL_REJECTION',
      JSON.stringify(audit[0]),
    );
    const r2 = await api('POST', '/student-departures', {
      token: T.guard,
      body: {
        studentIdentifier: IDS.diego,
        guardianIdentifier: IDS.guardian,
        decision: 'REJECTED',
      },
    });
    check('C10 rechazo manual sin motivo → 400', r2.res.status === 400, `${r2.res.status}`);
  }
  {
    const { data } = await api('POST', '/student-departures/validate-guardian', {
      token: T.guard,
      body: { studentIdentifier: IDS.diego, guardianIdentifier: IDS.guardian },
    });
    check(
      'C11 segunda validación del día avisa salida previa',
      data?.lastAuthorizedToday?.id === firstDepartureId,
      JSON.stringify(data?.lastAuthorizedToday),
    );
  }
  {
    const r = await api('POST', '/student-departures', {
      token: T.guard,
      body: {
        studentIdentifier: IDS.kevin,
        guardianIdentifier: IDS.guardian,
        departureType: 'FAKE',
      },
    });
    check('C12 tipo de salida inválido → 400', r.res.status === 400);
  }
  {
    const xss = '<script>alert(1)</script> retiro';
    const r = await api('POST', '/student-departures', {
      token: T.guard,
      body: {
        studentIdentifier: IDS.kevin,
        guardianIdentifier: IDS.guardian,
        departureType: 'EARLY',
        justificationReason: xss,
      },
    });
    const [rows] = await db.query(
      'SELECT justification_reason FROM student_departures WHERE id = ?',
      [r.data?.id ?? ''],
    );
    check(
      'C13 texto con HTML se guarda literal (sin ejecutar ni romper)',
      rows[0]?.justification_reason === xss,
    );
  }

  // ── D. Permisos programados ────────────────────────────────────────────────
  const permitBody = {
    studentIdentifier: IDS.kevin,
    permitDate: today,
    departureTime: '13:30',
    reason: 'Cita médica en la CCSS',
  };
  {
    const r = await api('POST', '/scheduled-permits', { token: T.guard, body: permitBody });
    check('D01 guarda no puede crear permisos → 403', r.res.status === 403, `${r.res.status}`);
  }
  let permitId;
  {
    const r = await api('POST', '/scheduled-permits', { token: T.director, body: permitBody });
    permitId = r.data?.id;
    check(
      'D02 director crea permiso para hoy → 201 PENDING',
      r.res.status === 201 && r.data?.status === 'PENDING',
      `${r.res.status} ${msg(r.json)}`,
    );
  }
  {
    const r1 = await api('POST', '/scheduled-permits', {
      token: T.admin,
      body: { ...permitBody, permitDate: crDate(-1) },
    });
    check(
      'D03 fecha pasada → 400',
      r1.res.status === 400 && /pasadas/.test(msg(r1.json)),
      `${r1.res.status} ${msg(r1.json)}`,
    );
    const r2 = await api('POST', '/scheduled-permits', {
      token: T.admin,
      body: { ...permitBody, departureTime: '25:00' },
    });
    check(
      'D04 hora inválida → 400',
      r2.res.status === 400 && /HH:mm/.test(msg(r2.json)),
      `${r2.res.status}`,
    );
    const r3 = await api('POST', '/scheduled-permits', {
      token: T.admin,
      body: { ...permitBody, studentIdentifier: IDS.guardian },
    });
    check('D05 cédula que no es estudiante → 404', r3.res.status === 404, `${r3.res.status}`);
    const r4 = await api('POST', '/scheduled-permits', {
      token: T.admin,
      body: { ...permitBody, permitDate: '2026-02-30' },
    });
    check('D06 fecha imposible (30 feb) → 400', r4.res.status === 400, `${r4.res.status}`);
  }
  {
    const { data } = await api('GET', '/scheduled-permits/today', { token: T.guard });
    check(
      'D07 el guarda ve el permiso de hoy',
      (data ?? []).some((p) => p.id === permitId),
    );
    const kpi = (await api('GET', '/student-departures/today-kpis', { token: T.guard })).data;
    check('D08 KPI de permisos pendientes = 1', kpi?.pendingPermits === 1, JSON.stringify(kpi));
    const v = (
      await api('POST', '/student-departures/validate-guardian', {
        token: T.guard,
        body: { studentIdentifier: IDS.kevin, guardianIdentifier: IDS.guardian },
      })
    ).data;
    check(
      'D09 la validación precarga el permiso pendiente',
      v?.pendingPermit?.id === permitId,
      JSON.stringify(v?.pendingPermit),
    );
  }
  {
    const r = await api('POST', '/student-departures', {
      token: T.guard,
      body: {
        studentIdentifier: IDS.diego,
        guardianIdentifier: IDS.guardian,
        scheduledPermitId: permitId,
      },
    });
    check(
      'D10 permiso de otro estudiante → rechazado',
      r.res.status === 404 || r.res.status === 400,
      `${r.res.status}`,
    );
  }
  {
    // Dos registros simultáneos con el mismo permiso: solo uno debe ganar.
    const body = {
      studentIdentifier: IDS.kevin,
      guardianIdentifier: IDS.guardian,
      departureType: 'EARLY',
      scheduledPermitId: permitId,
    };
    const [a, b] = await Promise.all([
      api('POST', '/student-departures', { token: T.guard, body }),
      api('POST', '/student-departures', { token: T.guard, body }),
    ]);
    const ok = [a, b].filter((x) => x.res.status === 201).length;
    check(
      'D11 uso simultáneo del mismo permiso → solo 1 registro',
      ok === 1,
      `statuses ${a.res.status}/${b.res.status}`,
    );
    const [rows] = await db.query(
      'SELECT status, completed_at FROM scheduled_departure_permits WHERE id = ?',
      [permitId],
    );
    check(
      'D12 permiso queda COMPLETED con fecha de cierre',
      rows[0]?.status === 'COMPLETED' && rows[0]?.completed_at,
      JSON.stringify(rows[0]),
    );
    const [linked] = await db.query(
      'SELECT COUNT(*) n FROM student_departures WHERE scheduled_permit_id = ?',
      [permitId],
    );
    check(
      'D13 exactamente una salida enlazada al permiso',
      Number(linked[0].n) === 1,
      `n=${linked[0].n}`,
    );
    const again = await api('PATCH', `/scheduled-permits/${permitId}/complete`, { token: T.guard });
    check(
      'D14 completar un permiso ya usado → 400',
      again.res.status === 400,
      `${again.res.status}`,
    );
  }
  {
    const tomorrow = await api('POST', '/scheduled-permits', {
      token: T.admin,
      body: { ...permitBody, studentIdentifier: IDS.diego, permitDate: crDate(1) },
    });
    const r = await api('POST', '/student-departures', {
      token: T.guard,
      body: {
        studentIdentifier: IDS.diego,
        guardianIdentifier: IDS.guardian,
        scheduledPermitId: tomorrow.data?.id,
      },
    });
    check(
      'D15 usar hoy un permiso de mañana → 400',
      r.res.status === 400,
      `${r.res.status} ${msg(r.json)}`,
    );
    const list = await api('GET', `/scheduled-permits?date=${crDate(1)}&status=PENDING`, {
      token: T.guard,
    });
    check(
      'D16 lista con filtros de fecha y estado',
      (list.data ?? []).length === 1 && list.data[0].id === tomorrow.data?.id,
      `n=${(list.data ?? []).length}`,
    );
  }
  {
    const manual = await api('POST', '/scheduled-permits', {
      token: T.admin,
      body: { ...permitBody, studentIdentifier: IDS.diego, departureTime: '15:00' },
    });
    const r = await api('PATCH', `/scheduled-permits/${manual.data?.id}/complete`, {
      token: T.guard,
    });
    check(
      'D17 guarda puede marcar un permiso como completado',
      r.res.status === 200 && r.data?.status === 'COMPLETED',
      `${r.res.status}`,
    );
    const r404 = await api(
      'PATCH',
      '/scheduled-permits/00000000-0000-0000-0000-000000000000/complete',
      { token: T.guard },
    );
    check('D18 permiso inexistente → 404', r404.res.status === 404, `${r404.res.status}`);
  }
  {
    const [admin] = await db.query('SELECT id_users FROM users WHERE national_id = ?', [
      IDS.admin.identifier,
    ]);
    await db.query(
      `INSERT INTO scheduled_departure_permits (id, student_id, authorized_by_id, permit_date, departure_time, reason, status)
       VALUES (UUID(), ?, ?, ?, '10:00', 'QA vencido', 'PENDING')`,
      [kevinId, admin[0].id_users, crDate(-1)],
    );
    const list = await api('GET', `/scheduled-permits?date=${crDate(-1)}`, { token: T.guard });
    check(
      'D19 permisos pendientes de días anteriores pasan a EXPIRED',
      (list.data ?? []).every((p) => p.status === 'EXPIRED') && (list.data ?? []).length === 1,
      JSON.stringify((list.data ?? []).map((p) => p.status)),
    );
  }

  // ── E. KPIs ────────────────────────────────────────────────────────────────
  {
    const { data } = await api('GET', '/student-departures/today-kpis', { token: T.guard });
    const [[expected]] = await db.query(
      `SELECT SUM(status='AUTHORIZED') total, SUM(status='AUTHORIZED' AND departure_type='EARLY') early,
              SUM(status='AUTHORIZED' AND departure_type='EMERGENCY') emergency, SUM(status='REJECTED') denied
         FROM student_departures`,
    );
    const [[pending]] = await db.query(
      "SELECT COUNT(*) n FROM scheduled_departure_permits WHERE permit_date = ? AND status='PENDING'",
      [today],
    );
    const ok =
      data?.totalDepartures === Number(expected.total) &&
      data?.earlyDepartures === Number(expected.early) &&
      data?.emergencyDepartures === Number(expected.emergency) &&
      data?.deniedAttempts === Number(expected.denied) &&
      data?.pendingPermits === Number(pending.n) &&
      data?.date === today;
    check(
      'E01 KPIs coinciden con la base de datos',
      ok,
      `api=${JSON.stringify(data)} db=${JSON.stringify(expected)} pend=${pending.n}`,
    );
  }

  // ── F. Historial y filtros ─────────────────────────────────────────────────
  {
    const all = await api(
      'GET',
      `/student-departures/history?startDate=${today}&endDate=${today}&limit=100`,
      { token: T.guard },
    );
    const [[n]] = await db.query('SELECT COUNT(*) n FROM student_departures');
    check(
      'F01 historial del día devuelve todos los registros',
      all.data?.total === Number(n.n),
      `api=${all.data?.total} db=${n.n}`,
    );
    const order = (all.data?.items ?? []).map((i) => i.departureTime);
    check(
      'F02 ordenado del más reciente al más antiguo',
      order.every((t, i) => i === 0 || order[i - 1] >= t),
    );
    const rej = await api(
      'GET',
      `/student-departures/history?status=REJECTED&startDate=${today}&endDate=${today}`,
      { token: T.guard },
    );
    check(
      'F03 filtro estado=REJECTED',
      (rej.data?.items ?? []).length > 0 && rej.data.items.every((i) => i.status === 'REJECTED'),
    );
    const emer = await api(
      'GET',
      `/student-departures/history?departureType=EMERGENCY&startDate=${today}&endDate=${today}`,
      { token: T.guard },
    );
    check(
      'F04 filtro tipo=EMERGENCY',
      emer.data?.total === 1 && emer.data.items[0].departureType === 'EMERGENCY',
      `n=${emer.data?.total}`,
    );
    const byName = await api(
      'GET',
      `/student-departures/history?search=kevin&startDate=${today}&endDate=${today}`,
      { token: T.guard },
    );
    check(
      'F05 búsqueda por nombre (sin distinguir mayúsculas)',
      (byName.data?.total ?? 0) > 0 &&
        byName.data.items.every((i) => i.student.fullName.includes('Kevin')),
    );
    const byId = await api(
      'GET',
      `/student-departures/history?search=3-0000-0020&startDate=${today}&endDate=${today}`,
      { token: T.guard },
    );
    check(
      'F06 búsqueda por cédula con guiones',
      (byId.data?.total ?? 0) > 0 &&
        byId.data.items.every((i) => i.student.nationalId === IDS.diego),
    );
    const inj = await api(
      'GET',
      `/student-departures/history?search=${encodeURIComponent("' OR 1=1 -- ")}`,
      { token: T.guard },
    );
    check(
      'F07 búsqueda con inyección SQL → 0 resultados, sin error',
      inj.res.status === 200 && inj.data?.total === 0,
      `${inj.res.status} ${inj.data?.total}`,
    );
    const page2 = await api(
      'GET',
      `/student-departures/history?startDate=${today}&endDate=${today}&limit=2&page=2`,
      { token: T.guard },
    );
    const page1 = await api(
      'GET',
      `/student-departures/history?startDate=${today}&endDate=${today}&limit=2&page=1`,
      { token: T.guard },
    );
    check(
      'F08 paginación sin solapamiento y totalPages correcto',
      page2.data?.items?.length === 2 &&
        !page2.data.items.some((i) => page1.data.items.some((j) => j.id === i.id)) &&
        page2.data.totalPages === Math.ceil(page2.data.total / 2),
    );
    const big = await api('GET', '/student-departures/history?limit=500', { token: T.guard });
    check('F09 limit > 100 → 400', big.res.status === 400, `${big.res.status}`);
    const inv = await api(
      'GET',
      `/student-departures/history?startDate=${today}&endDate=${crDate(-3)}`,
      { token: T.guard },
    );
    check(
      'F10 rango invertido → 400 en español',
      inv.res.status === 400 && /posterior/.test(msg(inv.json)),
      `${inv.res.status} ${msg(inv.json)}`,
    );
    const groups = await api('GET', '/student-departures/groups', { token: T.guard });
    const g101 = (groups.data ?? []).find((g) => g.name === '10-1');
    const byGroup = await api(
      'GET',
      `/student-departures/history?groupId=${g101?.id}&startDate=${today}&endDate=${today}&limit=100`,
      { token: T.guard },
    );
    check(
      'F11 filtro por sección',
      g101 &&
        byGroup.data?.total > 0 &&
        byGroup.data.items.every((i) => i.student.groupName === '10-1'),
      `group=${JSON.stringify(g101)}`,
    );
    const since = new Date(Date.now() - 30 * 60_000).toISOString();
    const feed = await api(
      'GET',
      `/student-departures/history?since=${encodeURIComponent(since)}`,
      { token: T.guard },
    );
    check(
      'F12 feed de los últimos 30 min (since)',
      feed.data?.total === Number(n.n),
      `api=${feed.data?.total}`,
    );
    const masked = (all.data?.items ?? [])
      .filter((i) => i.guardianIdentifierMasked)
      .every((i) => /^•+\d{4}$/.test(i.guardianIdentifierMasked));
    check('F13 cédula del encargado enmascarada en el historial', masked);
    const manual = (all.data?.items ?? []).find((i) => i.id === manualRejectionId);
    const mismatches = (all.data?.items ?? []).filter(
      (i) => i.status === 'REJECTED' && i.id !== manualRejectionId,
    );
    check(
      'F15 historial: rechazo manual marcado como encargado vinculado, no coincidentes como no vinculados',
      manual?.guardianLinked === true &&
        manual?.relationship === 'Padre' &&
        mismatches.length > 0 &&
        mismatches.every((i) => i.guardianLinked === false),
      JSON.stringify({
        manual: manual && { l: manual.guardianLinked, r: manual.relationship },
        mism: mismatches.map((i) => i.guardianLinked),
      }),
    );
  }
  {
    // Zona horaria: 23:30 de ayer (CR) = 05:30 UTC de hoy. Debe contarse en el día de ayer.
    const [guardRow] = await db.query('SELECT id_users FROM users WHERE national_id = ?', [
      IDS.guard,
    ]);
    const yesterday = crDate(-1);
    const utc = new Date(`${yesterday}T23:30:00-06:00`)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');
    await db.query(
      `INSERT INTO student_departures (id, student_id, guardian_identifier, security_guard_id, departure_time, status, departure_type)
       VALUES (UUID(), ?, '300000030', ?, ?, 'AUTHORIZED', 'REGULAR')`,
      [diegoId, guardRow[0].id_users, utc],
    );
    const y = await api(
      'GET',
      `/student-departures/history?startDate=${yesterday}&endDate=${yesterday}`,
      { token: T.guard },
    );
    const t = await api(
      'GET',
      `/student-departures/history?startDate=${today}&endDate=${today}&limit=100`,
      { token: T.guard },
    );
    check(
      'F14 zona horaria CR: 23:30 de ayer cuenta en ayer, no en hoy',
      y.data?.total === 1 &&
        !(t.data?.items ?? []).some(
          (i) => i.departureTime.startsWith(utc.slice(0, 10)) && i.departureTime.includes('05:30'),
        ),
      `ayer=${y.data?.total}`,
    );
  }

  // ── G. Exportaciones ───────────────────────────────────────────────────────
  {
    const x = await api(
      'GET',
      `/student-departures/export/excel?startDate=${today}&endDate=${today}&status=REJECTED`,
      { token: T.guard, raw: true },
    );
    const type = x.res.headers.get('content-type') ?? '';
    const disp = x.res.headers.get('content-disposition') ?? '';
    check(
      'G01 Excel: 200, tipo xlsx y nombre bitacora-salidas-*.xlsx',
      x.res.status === 200 &&
        type.includes('spreadsheetml') &&
        /bitacora-salidas-\d{4}-\d{2}-\d{2}.*\.xlsx/.test(disp),
      `${x.res.status} ${type} ${disp}`,
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(x.buffer);
    const ws = wb.worksheets[0];
    const text = [];
    ws.eachRow((row) =>
      text.push(
        row.values
          .slice(1)
          .map((v) =>
            v && typeof v === 'object' && 'richText' in v
              ? v.richText.map((r) => r.text).join('')
              : v,
          )
          .join(' | '),
      ),
    );
    const [[rej]] = await db.query(
      "SELECT COUNT(*) n FROM student_departures WHERE status='REJECTED'",
    );
    const header = text.findIndex((l) => l.startsWith('Fecha y hora'));
    const dataRows = text.slice(header + 1).filter((l) => /^\d{2}\/\d{2}\/\d{4}/.test(l));
    const [[rejToday]] = await db.query(
      "SELECT COUNT(*) n FROM student_departures WHERE status='REJECTED' AND departure_time >= ?",
      [new Date(`${today}T00:00:00-06:00`)],
    );
    check(
      'G02 Excel respeta el filtro (solo denegadas, mismo conteo)',
      header > 0 &&
        dataRows.length === Number(rejToday.n) &&
        dataRows.every((l) => l.includes('| Denegado |')),
      `filas=${dataRows.length} db=${rejToday.n} total=${rej.n}`,
    );
    check(
      'G03 Excel muestra "(no vinculado)" y cédula enmascarada',
      dataRows.some((l) => l.includes('(no vinculado)')) &&
        !text.some((l) => l.includes(IDS.teacher2)),
    );
    const manualRow = dataRows.find((l) => l.includes('Encargado en estado inconveniente'));
    check(
      'G07 Excel: rechazo manual muestra al encargado vinculado con parentesco',
      manualRow &&
        manualRow.includes('Roberto Rojas | Padre') &&
        !manualRow.includes('no vinculado'),
      manualRow,
    );
  }
  {
    const p = await api(
      'GET',
      `/student-departures/export/pdf?startDate=${today}&endDate=${today}`,
      { token: T.guard, raw: true },
    );
    check(
      'G04 PDF: 200, application/pdf y firma %PDF',
      p.res.status === 200 &&
        (p.res.headers.get('content-type') ?? '').includes('pdf') &&
        p.buffer.subarray(0, 4).toString() === '%PDF',
      `${p.res.status} ${p.buffer.length}B`,
    );
    const inv = await api(
      'GET',
      `/student-departures/export/pdf?startDate=${today}&endDate=${crDate(-2)}`,
      { token: T.guard },
    );
    check('G05 exportación con rango invertido → 400', inv.res.status === 400);
    const empty = await api(
      'GET',
      `/student-departures/export/excel?startDate=2020-01-01&endDate=2020-01-02`,
      { token: T.guard, raw: true },
    );
    check(
      'G06 exportación sin registros genera archivo válido',
      empty.res.status === 200 && empty.buffer.subarray(0, 2).toString() === 'PK',
    );
  }

  await db.end();
  const failed = results.filter((r) => !r.ok);
  console.log(
    `\n${results.length - failed.length}/${results.length} casos OK${failed.length ? `, ${failed.length} fallaron:` : '.'}`,
  );
  failed.forEach((f) => console.log(`  - ${f.id}: ${f.detail}`));
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((error) => {
  console.error('La suite se detuvo:', error);
  process.exit(1);
});
