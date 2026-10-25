/**
 * QA autenticada del Centro (Fase 6). Crea un expediente DiscQA aislado.
 * No imprime cédulas, tokens ni contraseñas.
 */
const BASE = process.env.API_URL || 'http://127.0.0.1:3000/api/v1';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

async function login(identifier) {
  const response = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password: requireEnv('DISCQA_PASSWORD') }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`login ${response.status}`);
  return payload.data.accessToken;
}

async function api(token, path, init = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body && typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body, bytes: Buffer.from(text || '') };
}

function dataOf(payload) {
  return payload?.data ?? payload;
}

async function main() {
  const teacher = await login('809000001');
  const guardian = await login('809000004');
  const director = await login('809000003');
  const strangerId = process.env.STRANGER_TEACHER_ID;

  const studentsPayload = dataOf((await api(teacher, '/disciplinary/students?q=DiscQA')).body);
  const students = Array.isArray(studentsPayload) ? studentsPayload : studentsPayload?.data ?? [];
  const student =
    students.find((item) => /Estudiante DiscQA/i.test(item.fullName || item.name || '')) ||
    students.find((item) => /DiscQA/i.test(item.fullName || item.name || ''));
  if (!student) throw new Error('No se encontró el estudiante DiscQA vinculado');
  const history = await api(guardian, `/disciplinary/students/${student.id}/history`);
  if (history.status >= 400) throw new Error('El encargado no puede ver el historial de ese estudiante');

  const types = dataOf((await api(teacher, '/disciplinary/infraction-types/options')).body) ?? [];
  const minor = types.find((item) => item.severity === 'MINOR' && /QA/i.test(item.name)) ?? types.find((item) => item.severity === 'MINOR');
  if (!minor) throw new Error('No hay tipo leve para la prueba aislada');

  const created = dataOf(
    (
      await api(teacher, '/disciplinary/cases', {
        method: 'POST',
        body: JSON.stringify({
          studentUserId: student.id ?? student.userId ?? student.studentUserId,
          infractionTypeId: minor.id,
          occurredAt: new Date().toISOString(),
          place: 'Aula QA Centro',
          description: 'Falta leve aislada para el cierre del Centro de apelaciones Sprint 6.',
        }),
      })
    ).body,
  );
  if (!created?.id || !/^AM-/.test(created.caseNumber || '')) throw new Error('No se creó el expediente aislado');

  const eligible = dataOf((await api(guardian, '/disciplinary/appeals/eligible')).body);
  const match = (eligible.data ?? []).find((item) => item.caseId === created.id);
  if (!match) throw new Error('El expediente aislado no apareció como elegible');

  const filed = dataOf(
    (
      await api(guardian, `/disciplinary/cases/${created.id}/revocations`, {
        method: 'POST',
        body: JSON.stringify({
          body: 'Se interpone revocatoria aislada porque el descargo no se valoró en la medida.',
          subsidiary: false,
        }),
      })
    ).body,
  );
  const listed = dataOf((await api(guardian, '/disciplinary/appeals')).body);
  if (!(listed.data ?? []).some((item) => item.id === filed.id || item.caseId === created.id)) {
    throw new Error('El recurso no apareció en el Centro');
  }

  const foreignList = dataOf((await api(guardian, '/disciplinary/appeals?studentUserId=1')).body);
  const widened = (foreignList.data ?? []).some((item) => item.studentUserId && item.studentUserId !== (student.id ?? student.userId));
  const dashboard = await api(guardian, '/disciplinary/appeals/dashboard');
  const exportDenied = await api(guardian, '/disciplinary/appeals/export/excel');

  const review = dataOf((await api(teacher, '/disciplinary/appeals/review')).body);
  const pending = (review.data ?? []).find((item) => item.caseId === created.id);
  if (!pending) throw new Error('La bandeja del guía no recibió el recurso aislado');

  const resolved = await api(teacher, `/disciplinary/cases/${created.id}/revocations/${pending.id}/resolution`, {
    method: 'POST',
    body: JSON.stringify({
      outcome: 'UPHOLD',
      reasoning: 'Se mantiene la medida porque el escrito no desvirtúa los hechos del expediente aislado.',
    }),
  });

  const inbox = dataOf((await api(guardian, '/disciplinary/notifications/mine')).body);
  const notice = (inbox.items ?? []).find((item) => item.caseId === created.id || item.caseNumber === created.caseNumber);
  const trackingBefore = dataOf((await api(guardian, `/disciplinary/appeals/${pending.id}`)).body);
  let read = { status: 0, body: null };
  if (notice && !notice.readAt) {
    read = await api(guardian, `/disciplinary/notifications/${notice.id}/read`, { method: 'POST', body: '{}' });
  }
  const trackingAfter = dataOf((await api(guardian, `/disciplinary/appeals/${pending.id}`)).body);

  const excel = await api(director, '/disciplinary/appeals/export/excel');
  const pdf = await api(director, '/disciplinary/appeals/export/pdf');
  const board = dataOf((await api(director, '/disciplinary/appeals/dashboard')).body);

  const summary = {
    caseNumber: created.caseNumber,
    filed: Boolean(filed?.id),
    listed: true,
    review: Boolean(pending?.id),
    resolved: resolved.status < 300,
    dashboardForbiddenForGuardian: dashboard.status === 403,
    exportForbiddenForGuardian: exportDenied.status === 403,
    didNotWiden: !widened,
    noticeKind: notice?.kind ?? null,
    openedWithoutRead: trackingBefore?.resolutionNotice ? trackingBefore.resolutionNotice.readAt == null : null,
    readConfirmed: Boolean(dataOf(read.body)?.readAt || trackingAfter?.resolutionNotice?.readAt),
    directorBoardTotal: board?.total ?? null,
    excelOk: excel.status === 200 && excel.bytes.length > 1000,
    pdfOk: excel.status === 200 && pdf.bytes.subarray(0, 4).toString() === '%PDF',
    pdfPages: (pdf.bytes.toString('latin1').match(/\/Type \/Page(?!s)/g) || []).length,
    unusedStranger: Boolean(strangerId),
  };
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
