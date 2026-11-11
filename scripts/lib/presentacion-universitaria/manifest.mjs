import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { MANIFEST_DEFAULT_PATH, MANIFEST_VERSION, NATIONAL_ID_PREFIX } from './constants.mjs';

export function emptyManifest(meta = {}) {
  return {
    version: MANIFEST_VERSION,
    runId: randomUUID(),
    appliedAt: null,
    nationalIdPrefix: NATIONAL_ID_PREFIX,
    demoPeriodId: null,
    demoYearId: null,
    ...meta,
    academic_years: [],
    academic_periods: [],
    specialties: [],
    subjects: [],
    sections: [],
    groups: [],
    users: [],
    nationalIds: [],
    user_roles: [],
    teaching_assignments: [],
    schedule_entries: [],
    group_enrollments: [],
    guardian_student_links: [],
    attendance_sessions: [],
    attendance: [],
    absence_justifications: [],
    justification_evidences: [],
    absenteeism_alerts: [],
    absenteeism_alert_notifications: [],
    disciplinary_infraction_types: [],
    disciplinary_cases: [],
    disciplinary_case_events: [],
    disciplinary_communications: [],
    disciplinary_notifications: [],
    disciplinary_appeals: [],
    disciplinary_defenses: [],
    communications: [],
    communication_recipients: [],
    communication_reads: [],
    scheduled_departure_permits: [],
    student_departures: [],
  };
}

export function resolveManifestPath(cwd, argPath) {
  const rel = argPath ?? MANIFEST_DEFAULT_PATH;
  return path.isAbsolute(rel) ? rel : path.join(cwd, rel);
}

export function loadManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`No existe manifiesto: ${manifestPath}`);
  }
  const raw = fs.readFileSync(manifestPath, 'utf8');
  const data = JSON.parse(raw);
  if (data.version !== MANIFEST_VERSION) {
    throw new Error(`Versión de manifiesto no soportada: ${data.version}`);
  }
  return data;
}

export function saveManifest(manifestPath, manifest) {
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

export function pushId(manifest, bucket, id) {
  if (id == null) return;
  if (!manifest[bucket]) manifest[bucket] = [];
  if (!manifest[bucket].includes(id)) manifest[bucket].push(id);
}
