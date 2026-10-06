/**
 * Supplemental Sprint 2 live checks: 401/403/invalid token + MySQL persistence + T05 API twin.
 * Does not print secrets.
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const BASE = `http://127.0.0.1:${process.env.PORT || 3000}/api/v1`;
const rows = [];
const log = (id, status, detail) => {
  rows.push({ id, status, detail });
  console.log(`[${status}] ${id} — ${detail}`);
};

async function api(method, p, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { res, json, data: json?.data ?? json };
}

async function main() {
  // Bad login
  {
    const { res } = await api('POST', '/auth/login', {
      body: { identifier: '100000000', password: 'WrongPass99' },
    });
    log('AUTH-bad-login', res.status === 401 ? 'PASS' : 'FAIL', `status=${res.status}`);
  }

  // No token
  {
    const { res } = await api('GET', '/users/me');
    log('AUTH-no-token', res.status === 401 ? 'PASS' : 'FAIL', `status=${res.status}`);
  }

  // Invalid token
  {
    const { res } = await api('GET', '/users/me', { token: 'not.a.jwt' });
    log('AUTH-bad-token', res.status === 401 ? 'PASS' : 'FAIL', `status=${res.status}`);
  }

  const login = await api('POST', '/auth/login', {
    body: { identifier: '100000000', password: 'Admin1234' },
  });
  const token = login.data?.accessToken;
  if (!token) {
    log('AUTH-admin', 'FAIL', 'no token');
    process.exit(1);
  }
  log('AUTH-admin', 'PASS', 'login ok');

  // Persistence: create ACTIVE then read from MySQL + GET by id
  const stamp = Date.now().toString().slice(-8);
  const nid = `3${stamp}`.slice(0, 12);
  const email = `s2.persist.${stamp}@edusmart.test`;
  const created = await api('POST', '/users', {
    token,
    body: {
      nationalId: nid,
      name: 'Persist',
      first_lastname: 'Check',
      email,
      password: 'TempPass12',
      status: 'ACTIVE',
      roleIds: [3],
    },
  });
  const id = created.data?.id ?? created.data?.id_users;
  log(
    'PBI15-create-api',
    created.res.status === 201 || created.res.ok ? 'PASS' : 'FAIL',
    `status=${created.res.status} id=${id}`,
  );

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });
  const [dbRows] = await conn.query(
    `SELECT id_users, email, status, national_id FROM users WHERE id_users = ?`,
    [id],
  );
  const dbOk =
    dbRows[0] &&
    dbRows[0].email === email &&
    dbRows[0].status === 'ACTIVE' &&
    String(dbRows[0].national_id) === nid;
  log('PBI15-mysql-persist', dbOk ? 'PASS' : 'FAIL', JSON.stringify(dbRows[0] || null));

  const getOne = await api('GET', `/users/${id}`, { token });
  log(
    'PBI15-readback',
    getOne.res.ok && (getOne.data?.email === email || getOne.data?.id === id) ? 'PASS' : 'FAIL',
    `status=${getOne.res.status}`,
  );

  // T05 twin: create-another = second create succeeds (toast is UI-only)
  const nid2 = `2${stamp}`.slice(0, 12);
  const email2 = `s2.another.${stamp}@edusmart.test`;
  const second = await api('POST', '/users', {
    token,
    body: {
      nationalId: nid2,
      name: 'Another',
      first_lastname: 'User',
      email: email2,
      password: 'TempPass12',
      status: 'ACTIVE',
      roleIds: [3],
    },
  });
  const id2 = second.data?.id ?? second.data?.id_users;
  const [db2] = await conn.query(`SELECT id_users FROM users WHERE id_users = ?`, [id2]);
  log(
    'S2-T05-persist-twin',
    second.res.ok && db2[0] ? 'PASS' : 'FAIL',
    `second create status=${second.res.status} mysql=${Boolean(db2[0])} (toast UI not browser-tested)`,
  );

  // PATCH me
  const me = await api('GET', '/users/me', { token });
  const phoneBefore = me.data?.phone ?? null;
  const patch = await api('PATCH', '/users/me', {
    token,
    body: { phone: '26651234' },
  });
  const me2 = await api('GET', '/users/me', { token });
  const phoneOk = me2.data?.phone === '26651234' || String(me2.data?.phone || '').includes('2665');
  log('EP02-profile-patch', patch.res.ok && phoneOk ? 'PASS' : 'FAIL', `phone=${me2.data?.phone}`);
  // restore phone if possible
  if (phoneBefore !== undefined) {
    await api('PATCH', '/users/me', { token, body: { phone: phoneBefore } });
  }

  await conn.end();

  const fail = rows.filter((r) => r.status === 'FAIL').length;
  console.log(`SUMMARY PASS=${rows.filter((r) => r.status === 'PASS').length} FAIL=${fail}`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
