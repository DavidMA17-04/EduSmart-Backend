/**
 * Sprint 4 disciplinary E2E (PBI-37) — API-level against local Nest + MySQL.
 * Run: npm run test:s4-e2e
 * Credentials only from DISCQA_* env vars. Missing creds → SKIP, not FAIL.
 * Does not reopen AM-2026-0001 / AM-2026-0002.
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const BASE = `http://127.0.0.1:${process.env.PORT || 3000}/api/v1`;
const results = [];

function record(id, status, detail = '') {
  results.push({ id, status, detail });
  const mark = status === 'PASS' ? 'PASS' : status === 'SKIP' ? 'SKIP' : 'FAIL';
  console.log(`[${mark}] ${id}${detail ? ' — ' + detail : ''}`);
}

function cred(prefix) {
  const identifier = process.env[`DISCQA_${prefix}_ID`];
  const password = process.env[`DISCQA_${prefix}_PASSWORD`];
  if (!identifier || !password) return null;
  return { identifier, password };
}

async function api(method, pathName, { token, body, form, raw } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${pathName}`, { method, headers, body: payload });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (raw) return { res, json, text };
  return { res, json };
}

function unwrap(json) {
  return json?.data ?? json;
}

async function login(identifier, password) {
  const { res, json } = await api('POST', '/auth/login', {
    body: { identifier, password },
  });
  if (!res.ok) {
    throw new Error(`login failed ${res.status}: ${JSON.stringify(json)}`);
  }
  const data = unwrap(json);
  return {
    token: data.accessToken,
    user: data.user,
  };
}

async function tryLogin(prefix) {
  const pair = cred(prefix);
  if (!pair) return { session: null, skip: `missing DISCQA_${prefix}_ID/PASSWORD` };
  try {
    return { session: await login(pair.identifier, pair.password), skip: null };
  } catch (error) {
    return { session: null, skip: error.message };
  }
}

async function dbConn() {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3307),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });
}

function occurredAtIso() {
  const when = new Date();
  when.setMinutes(when.getMinutes() - 30);
  return when.toISOString();
}

const FACTS = 'Hechos de prueba automatizada Sprint 4 para cierre de PBI-37.';
const PLACE = 'Aula QA S4';
const OBSERVATION = 'Observación de investigación registrada por la suite S4.';
const ACTION = 'Acción correctiva de prueba S4';
const REASONING =
  'Se mantiene la falta porque los hechos y el descargo no desvirtúan lo reportado en este expediente.';
const DEFENSE = 'El estudiante no participó en los hechos que se le atribuyen.';

async function main() {
  console.log(`S4 disciplinary E2E against ${BASE}`);

  let conn;
  try {
    conn = await dbConn();
    const [tables] = await conn.query('SHOW TABLES');
    const names = tables.map((row) => Object.values(row)[0]);
    const needed = [
      'disciplinary_cases',
      'disciplinary_infraction_types',
      'disciplinary_notifications',
      'disciplinary_communications',
      'disciplinary_evidences',
      'guardian_student_links',
    ];
    const missing = needed.filter((name) => !names.includes(name));
    record(
      'S4-tables',
      missing.length === 0 ? 'PASS' : 'FAIL',
      missing.length ? `missing=${missing.join(',')}` : `ok=${needed.length}`,
    );
  } catch (error) {
    record('S4-tables', 'FAIL', error.message);
  }

  {
    const { res } = await api('GET', '/disciplinary/cases');
    record('S4-401-cases', res.status === 401 ? 'PASS' : 'FAIL', `status=${res.status}`);
  }
  {
    const { res } = await api('GET', '/disciplinary/cases/1/evidences/1/file');
    record(
      'S4-401-evidence',
      res.status === 401 || res.status === 404 ? 'PASS' : 'FAIL',
      `status=${res.status}`,
    );
  }
  {
    const publicRes = await fetch(`http://127.0.0.1:${process.env.PORT || 3000}/uploads/disciplinary/1/x.pdf`);
    record(
      'S4-uploads-public',
      publicRes.status === 401 || publicRes.status === 403 || publicRes.status === 404 ? 'PASS' : 'FAIL',
      `status=${publicRes.status}`,
    );
  }

  const teacherLogin = await tryLogin('TEACHER');
  if (!teacherLogin.session) {
    record('S4-auth-teacher', 'SKIP', teacherLogin.skip);
  } else {
    record('S4-auth-teacher', 'PASS', `userId=${teacherLogin.session.user?.id ?? '?'}`);
  }
  const teacher = teacherLogin.session;

  const guardianLogin = await tryLogin('GUARDIAN');
  if (!guardianLogin.session) {
    record('S4-auth-guardian', 'SKIP', guardianLogin.skip);
  } else {
    record('S4-auth-guardian', 'PASS', `userId=${guardianLogin.session.user?.id ?? '?'}`);
  }
  const guardian = guardianLogin.session;

  const studentLogin = await tryLogin('STUDENT');
  if (!studentLogin.session) {
    record('S4-auth-student', 'SKIP', studentLogin.skip);
  } else {
    record('S4-auth-student', 'PASS', `userId=${studentLogin.session.user?.id ?? '?'}`);
  }

  const foreignLogin = await tryLogin('FOREIGN_TEACHER');
  if (!foreignLogin.session) {
    record('S4-auth-foreign-teacher', 'SKIP', foreignLogin.skip);
  } else {
    record('S4-auth-foreign-teacher', 'PASS', `userId=${foreignLogin.session.user?.id ?? '?'}`);
  }

  let minorTypeId = null;
  let seriousTypeId = null;
  let studentUserId = studentLogin.session?.user?.id ?? null;

  if (conn) {
    try {
      const [types] = await conn.query(
        `SELECT id_disciplinary_infraction_types AS id, severity
         FROM disciplinary_infraction_types
         WHERE is_active = 1`,
      );
      minorTypeId = types.find((row) => row.severity === 'MINOR')?.id ?? null;
      seriousTypeId = types.find((row) => row.severity === 'SERIOUS')?.id ?? null;
      if (!studentUserId && cred('STUDENT')) {
        const [users] = await conn.query(`SELECT id_users AS id FROM users WHERE national_id = ? LIMIT 1`, [
          cred('STUDENT').identifier,
        ]);
        studentUserId = users[0]?.id ?? null;
      }
      if (!studentUserId && teacher) {
        const hits = unwrap(
          (await api('GET', '/disciplinary/students?q=DiscQA', { token: teacher.token })).json,
        );
        const list = Array.isArray(hits) ? hits : hits?.items ?? [];
        studentUserId = list[0]?.id ?? null;
      }
      if (minorTypeId && seriousTypeId) {
        record(
          'S4-fixtures',
          'PASS',
          `minor=${minorTypeId} serious=${seriousTypeId} student=${studentUserId ?? 'pending'}`,
        );
      } else if (!teacher) {
        record(
          'S4-fixtures',
          'SKIP',
          'need DISCQA_TEACHER_* and seed DiscQA (tipos leve/grave)',
        );
      } else {
        record('S4-fixtures', 'FAIL', `minor=${minorTypeId} serious=${seriousTypeId} student=${studentUserId}`);
      }
    } catch (error) {
      record('S4-fixtures', teacher ? 'FAIL' : 'SKIP', error.message);
    }
  } else {
    record('S4-fixtures', teacher ? 'FAIL' : 'SKIP', 'no db');
  }

  let minorCase = null;
  if (!teacher) {
    record('S4-minor-create', 'SKIP', 'no teacher session');
  } else if (!minorTypeId || !studentUserId) {
    record('S4-minor-create', 'SKIP', 'missing type/student fixture');
  } else {
    const created = await api('POST', '/disciplinary/cases', {
      token: teacher.token,
      body: {
        studentUserId,
        infractionTypeId: minorTypeId,
        occurredAt: occurredAtIso(),
        place: PLACE,
        description: FACTS,
      },
    });
    const view = unwrap(created.json);
    minorCase = created.res.ok ? view : null;
    record(
      'S4-minor-create',
      minorCase && view?.track === 'DIRECT' && view?.status === 'NOTIFIED' ? 'PASS' : 'FAIL',
      `status=${created.res.status} number=${view?.caseNumber} state=${view?.status}`,
    );
  }

  if (!guardian) {
    record('S4-minor-read', 'SKIP', 'no guardian session');
    record('S4-minor-reread', 'SKIP', 'no guardian session');
  } else if (!minorCase) {
    record('S4-minor-read', 'SKIP', 'no minor case');
    record('S4-minor-reread', 'SKIP', 'no minor case');
  } else {
    const inbox = unwrap((await api('GET', '/disciplinary/notifications/mine', { token: guardian.token })).json);
    const items = inbox?.items ?? [];
    const note = items.find((item) => item.caseId === minorCase.id) ?? items[0];
    if (!note?.id) {
      record('S4-minor-read', 'SKIP', 'no notification in inbox');
      record('S4-minor-reread', 'SKIP', 'no notification in inbox');
    } else {
      const first = await api('POST', `/disciplinary/notifications/${note.id}/read`, { token: guardian.token });
      const firstView = unwrap(first.json);
      record(
        'S4-minor-read',
        first.res.ok && firstView?.readAt ? 'PASS' : 'FAIL',
        `status=${first.res.status}`,
      );
      const second = await api('POST', `/disciplinary/notifications/${note.id}/read`, { token: guardian.token });
      const secondView = unwrap(second.json);
      record(
        'S4-minor-reread',
        second.res.ok && secondView?.readAt === firstView?.readAt ? 'PASS' : 'FAIL',
        `status=${second.res.status} same=${secondView?.readAt === firstView?.readAt}`,
      );
    }
  }

  if (!guardian) {
    record('S4-403-dashboard', 'SKIP', 'no guardian session');
  } else {
    const board = await api('GET', '/disciplinary/dashboard', { token: guardian.token });
    record('S4-403-dashboard', board.res.status === 403 ? 'PASS' : 'FAIL', `status=${board.res.status}`);
  }

  if (!guardian) {
    record('S4-403-unlinked', 'SKIP', 'no guardian session');
  } else if (!conn) {
    record('S4-403-unlinked', 'SKIP', 'no db');
  } else {
    try {
      const [foreign] = await conn.query(
        `SELECT c.id_disciplinary_cases AS id
         FROM disciplinary_cases c
         WHERE c.id_users_student NOT IN (
           SELECT l.id_users_student FROM guardian_student_links l WHERE l.id_users_guardian = ?
         )
         LIMIT 1`,
        [guardian.user?.id],
      );
      const targetId = foreign[0]?.id ?? 999999;
      const peek = await api('GET', `/disciplinary/cases/${targetId}`, { token: guardian.token });
      record(
        'S4-403-unlinked',
        peek.res.status === 403 || peek.res.status === 404 ? 'PASS' : 'FAIL',
        `status=${peek.res.status} caseId=${targetId}`,
      );
    } catch (error) {
      record('S4-403-unlinked', 'FAIL', error.message);
    }
  }

  let graveCase = null;
  if (!teacher) {
    record('S4-grave-create', 'SKIP', 'no teacher session');
  } else if (!seriousTypeId || !studentUserId) {
    record('S4-grave-create', 'SKIP', 'missing type/student fixture');
  } else {
    const created = await api('POST', '/disciplinary/cases', {
      token: teacher.token,
      body: {
        studentUserId,
        infractionTypeId: seriousTypeId,
        occurredAt: occurredAtIso(),
        place: PLACE,
        description: FACTS,
        witnesses: 'Testigo de QA interno',
      },
    });
    const view = unwrap(created.json);
    graveCase = created.res.ok ? view : null;
    record(
      'S4-grave-create',
      graveCase && view?.track === 'DUE_PROCESS' && view?.status === 'REPORTED' ? 'PASS' : 'FAIL',
      `status=${created.res.status} number=${view?.caseNumber} state=${view?.status}`,
    );
  }

  if (!foreignLogin.session) {
    record('S4-403-foreign-conduct', 'SKIP', foreignLogin.skip);
  } else if (!graveCase) {
    record('S4-403-foreign-conduct', 'SKIP', 'no grave case');
  } else {
    const start = await api('POST', `/disciplinary/cases/${graveCase.id}/investigation`, {
      token: foreignLogin.session.token,
    });
    record(
      'S4-403-foreign-conduct',
      start.res.status === 403 ? 'PASS' : 'FAIL',
      `status=${start.res.status}`,
    );
  }

  if (!teacher || !graveCase) {
    record('S4-grave-investigate', 'SKIP', 'blocked');
    record('S4-grave-observe', 'SKIP', 'blocked');
    record('S4-grave-communicate', 'SKIP', 'blocked');
  } else {
    const start = await api('POST', `/disciplinary/cases/${graveCase.id}/investigation`, {
      token: teacher.token,
    });
    const started = unwrap(start.json);
    record(
      'S4-grave-investigate',
      start.res.ok && started?.status === 'INVESTIGATING' ? 'PASS' : 'FAIL',
      `status=${start.res.status} state=${started?.status}`,
    );
    const observe = await api('POST', `/disciplinary/cases/${graveCase.id}/observations`, {
      token: teacher.token,
      body: { message: OBSERVATION },
    });
    record('S4-grave-observe', observe.res.ok ? 'PASS' : 'FAIL', `status=${observe.res.status}`);
    const form = new FormData();
    form.append(
      'file',
      new Blob(['not-a-pdf'], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
      'nota.docx',
    );
    const bad = await api('POST', `/disciplinary/cases/${graveCase.id}/evidences`, {
      token: teacher.token,
      form,
    });
    record(
      'S4-evidence-invalid',
      bad.res.status >= 400 && bad.res.status < 500 ? 'PASS' : 'FAIL',
      `status=${bad.res.status}`,
    );
    const communicate = await api('POST', `/disciplinary/cases/${graveCase.id}/formal-communication`, {
      token: teacher.token,
      body: { proposedAction: ACTION },
    });
    const charged = unwrap(communicate.json);
    record(
      'S4-grave-communicate',
      communicate.res.ok && charged?.status === 'COMMUNICATED' ? 'PASS' : 'FAIL',
      `status=${communicate.res.status} state=${charged?.status}`,
    );
    if (communicate.res.ok) graveCase = { ...graveCase, ...charged };
  }

  if (!teacher || !graveCase) {
    record('S4-evidence-invalid', 'SKIP', 'blocked');
  }

  if (!guardian) {
    record('S4-grave-defense', 'SKIP', 'no guardian session');
  } else if (!graveCase) {
    record('S4-grave-defense', 'SKIP', 'no grave case');
  } else {
    const form = new FormData();
    form.append('body', DEFENSE);
    const filed = await api('POST', `/disciplinary/cases/${graveCase.id}/defenses`, {
      token: guardian.token,
      form,
    });
    const view = unwrap(filed.json);
    const deadline =
      filed.res.status === 400 &&
      JSON.stringify(filed.json ?? {}).includes('DEFENSE_DEADLINE');
    if (deadline) {
      record('S4-grave-defense', 'SKIP', 'seed clock outside defense window');
    } else {
      record(
        'S4-grave-defense',
        filed.res.ok && view?.status === 'PENDING_RESOLUTION' ? 'PASS' : 'FAIL',
        `status=${filed.res.status} state=${view?.status ?? view?.code}`,
      );
      if (filed.res.ok) {
        graveCase = { ...graveCase, ...view, id: Number(view.caseId ?? graveCase.id) };
      }
    }
  }

  if (!teacher || !graveCase) {
    record('S4-grave-resolve', 'SKIP', 'blocked');
  } else {
    const resolved = await api('POST', `/disciplinary/cases/${graveCase.id}/resolution`, {
      token: teacher.token,
      body: { outcome: 'UPHOLD', reasoning: REASONING },
    });
    const view = unwrap(resolved.json);
    if (!resolved.res.ok && graveCase.status !== 'PENDING_RESOLUTION') {
      record('S4-grave-resolve', 'SKIP', `stage=${graveCase.status}`);
    } else {
      record(
        'S4-grave-resolve',
        resolved.res.ok && view?.status === 'RESOLVED' ? 'PASS' : 'FAIL',
        `status=${resolved.res.status} state=${view?.status ?? view?.code}`,
      );
    }
  }

  if (guardian && graveCase) {
    const detail = unwrap(
      (await api('GET', `/disciplinary/cases/${graveCase.id}`, { token: guardian.token })).json,
    );
    const hidden =
      detail &&
      (detail.witnesses == null || detail.witnesses === '') &&
      !(detail.events ?? []).some((event) => event.visibility === 'RESERVED' || event.type === 'COUNSEL_OPINION');
    record(
      'S4-reserved-hidden',
      hidden ? 'PASS' : 'FAIL',
      `witnesses=${detail?.witnesses ?? 'n/a'} events=${(detail?.events ?? []).length}`,
    );
  } else {
    record('S4-reserved-hidden', 'SKIP', 'no guardian/grave case');
  }

  if (conn) await conn.end();
  printSummary();
}

function printSummary() {
  const pass = results.filter((row) => row.status === 'PASS').length;
  const fail = results.filter((row) => row.status === 'FAIL').length;
  const skip = results.filter((row) => row.status === 'SKIP').length;
  console.log('\n=== S4 DISCIPLINARY E2E SUMMARY ===');
  console.log(`PASS=${pass} FAIL=${fail} SKIP=${skip} TOTAL=${results.length}`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
