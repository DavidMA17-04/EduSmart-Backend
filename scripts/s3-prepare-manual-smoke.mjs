/**
 * Prepare + probe Sprint 3 manual smoke fixtures (M1/M2/M3).
 * Run: node scripts/s3-prepare-manual-smoke.mjs
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const BASE = `http://127.0.0.1:${process.env.PORT || 3000}/api/v1`;

async function api(method, pathName, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${pathName}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { res, json, data: json?.data ?? json };
}

async function login(identifier, password) {
  const { res, data } = await api('POST', '/auth/login', {
    body: { identifier, password },
  });
  if (!res.ok) throw new Error(`login ${identifier} failed ${res.status}`);
  return {
    token: data.accessToken,
    user: data.user,
    permissions: data.user?.permissions ?? [],
    roles: data.user?.roles ?? [],
  };
}

function out(title, obj) {
  console.log(`\n=== ${title} ===`);
  console.log(typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2));
}

async function main() {
  // Ensure seed fixtures exist
  const seed = spawnSync(process.execPath, [path.join(__dirname, 's3-seed-fixtures.mjs')], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
  });
  if (seed.status !== 0) {
    console.error(seed.stdout || seed.stderr);
    throw new Error('seed failed');
  }
  out('SEED', seed.stdout.trim().split('\n').slice(-20).join('\n'));

  const admin = await login('100000000', 'Admin1234');
  out('ADMIN', {
    id: admin.user?.id,
    roles: admin.roles,
    hasEdit: admin.permissions.includes('attendance.edit'),
    hasView: admin.permissions.includes('attendance.view'),
  });

  const teacher = await login('300000001', 'TempPass12');
  out('TEACHER', {
    id: teacher.user?.id,
    roles: teacher.roles,
    permissions: teacher.permissions.filter((p) => p.startsWith('attendance.')),
  });

  const student = await login('300000002', 'TempPass12');
  out('STUDENT', {
    id: student.user?.id,
    roles: student.roles,
    permissions: student.permissions.filter((p) => p.startsWith('attendance.')),
    hasJustify: student.permissions.includes('attendance.justify'),
  });

  // M1 rules
  const rules = await api('GET', '/attendance/absenteeism/rules', {
    token: admin.token,
  });
  out('RULES', {
    status: rules.res.status,
    rules: (Array.isArray(rules.data) ? rules.data : []).map((r) => ({
      id: r.id,
      code: r.code,
      label: r.label,
      thresholdValue: r.thresholdValue,
      isActive: r.isActive,
      riskLevel: r.riskLevel,
    })),
  });

  // Prefer a medium-risk rule for safe threshold tweak
  const ruleList = Array.isArray(rules.data) ? rules.data : [];
  const safeRule =
    ruleList.find((r) => String(r.code).toLowerCase().includes('medium')) ||
    ruleList.find((r) => r.riskLevel === 'MEDIUM') ||
    ruleList[0];
  out('SAFE_RULE_FOR_M1', safeRule
    ? {
        id: safeRule.id,
        code: safeRule.code,
        label: safeRule.label,
        thresholdValue: safeRule.thresholdValue,
        isActive: safeRule.isActive,
        suggestedNewThreshold: safeRule.thresholdValue + 1,
      }
    : null);

  // Groups / offerings for teacher
  const groups = await api('GET', '/attendance/groups', { token: teacher.token });
  out('TEACHER_GROUPS', { status: groups.res.status, data: groups.data });
  const groupArr = Array.isArray(groups.data) ? groups.data : [];
  const groupId = groupArr[0]?.groupId;
  let offerings = [];
  if (groupId) {
    const offs = await api(
      'GET',
      `/attendance/groups/${groupId}/available-offerings`,
      { token: teacher.token },
    );
    offerings = Array.isArray(offs.data) ? offs.data : [];
    out('OFFERINGS', { status: offs.res.status, data: offerings });
  }

  // Prepare ABSENT record for M2 (student justify)
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  // Close any open sessions for TA to allow clean new session
  await conn.query(
    `UPDATE attendance_sessions SET status='CLOSED', closed_at=NOW()
     WHERE status='OPEN' AND id_teaching_assignments=?`,
    [offerings[0]?.teachingAssignmentId ?? 1],
  );

  const create = await api('POST', '/attendance/sessions', {
    token: teacher.token,
    body: {
      groupId,
      teachingAssignmentId: offerings[0]?.teachingAssignmentId,
    },
  });
  const sessionId = create.data?.sessionId ?? create.data?.id;
  out('M2_SESSION_CREATE', {
    status: create.res.status,
    sessionId,
  });

  let attendanceId = null;
  if (sessionId) {
    const save = await api('PUT', `/attendance/sessions/${sessionId}/records`, {
      token: teacher.token,
      body: {
        records: [{ studentUserId: student.user.id, status: 'ABSENT' }],
      },
    });
    const saved = Array.isArray(save.data) ? save.data : [];
    attendanceId = saved[0]?.id ?? saved[0]?.attendanceId ?? null;
    if (!attendanceId) {
      const [rows] = await conn.query(
        `SELECT id_attendance AS id, status, justification_status
         FROM attendance
         WHERE id_attendance_sessions=? AND id_users_student=? LIMIT 1`,
        [sessionId, student.user.id],
      );
      attendanceId = rows[0]?.id ?? null;
      out('ATTENDANCE_ROW', rows[0] ?? null);
    } else {
      const [rows] = await conn.query(
        `SELECT id_attendance AS id, status, justification_status, id_attendance_sessions AS sessionId
         FROM attendance WHERE id_attendance=?`,
        [attendanceId],
      );
      out('ATTENDANCE_ROW', rows[0] ?? null);
    }
  }

  // Justifiable absences for student
  const justAbs = await api(
    'GET',
    '/attendance/justifications/justifiable-absences',
    { token: student.token },
  );
  out('JUSTIFIABLE_ABSENCES', {
    status: justAbs.res.status,
    items: justAbs.data,
  });

  // Demo mode check (frontend)
  out('VITE_DEMO_JUSTIFICATIONS', {
    feEnvFileExists: false,
    note: 'No frontend/.env — import.meta.env.VITE_DEMO_JUSTIFICATIONS defaults undefined → demo OFF',
  });

  // Teacher without justify confirmation
  out('TEACHER_HAS_JUSTIFY', teacher.permissions.includes('attendance.justify'));

  out('MANUAL_SMOKE_SUMMARY', {
    m1: {
      ready: Boolean(safeRule) && admin.permissions.includes('attendance.edit'),
      url: 'http://localhost:5173/admin/attendance/alerts',
      user: '100000000',
      password: 'Admin1234',
      ruleId: safeRule?.id,
      ruleLabel: safeRule?.label,
      currentThreshold: safeRule?.thresholdValue,
      currentActive: safeRule?.isActive,
      newThreshold: safeRule ? safeRule.thresholdValue + 1 : null,
    },
    m2: {
      ready: Boolean(attendanceId) && student.permissions.includes('attendance.justify'),
      demoOff: true,
      student: '300000002',
      password: 'TempPass12',
      url: 'http://localhost:5173/admin/attendance/justifications',
      attendanceId,
      sessionId,
      noJustifyUser: '300000001',
      teacherHasJustify: teacher.permissions.includes('attendance.justify'),
    },
    m3: {
      ready: Boolean(groupId) && offerings.length > 0,
      teacher: '300000001',
      student: '300000002',
      password: 'TempPass12',
      groupId,
      groupName: groupArr[0]?.name,
      offering: offerings[0]?.name,
      teachingAssignmentId: offerings[0]?.teachingAssignmentId,
      newSessionUrl: 'http://localhost:5173/admin/attendance/new',
      redeemUrl: 'http://localhost:5173/admin/attendance/redeem',
      note: 'For M3: close open sessions first or start class from UI; generate token then redeem',
    },
  });

  await conn.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
