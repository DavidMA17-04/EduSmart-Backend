/**
 * Reversión controlada según manifiesto (solo registros creados por el seed).
 */

export async function rollbackFromManifest(conn, manifest, { dryRun = false } = {}) {
  const steps = [];
  const run = async (label, sql, params) => {
    steps.push({ label, sql, params });
    if (dryRun) return { affectedRows: 0 };
    return conn.query(sql, params);
  };

  const ids = (key) => (manifest[key]?.length ? manifest[key] : []);

  if (ids('student_departures').length) {
    await run('student_departures', `DELETE FROM student_departures WHERE id IN (?)`, [
      ids('student_departures'),
    ]);
  }
  if (ids('scheduled_departure_permits').length) {
    await run('scheduled_departure_permits', `DELETE FROM scheduled_departure_permits WHERE id IN (?)`, [
      ids('scheduled_departure_permits'),
    ]);
  }
  if (ids('communication_reads').length) {
    await run('communication_reads', `DELETE FROM communication_reads WHERE id IN (?)`, [
      ids('communication_reads'),
    ]);
  }
  if (ids('communication_recipients').length) {
    await run('communication_recipients', `DELETE FROM communication_recipients WHERE id IN (?)`, [
      ids('communication_recipients'),
    ]);
  }
  if (ids('communications').length) {
    await run('communications', `DELETE FROM communications WHERE id IN (?)`, [ids('communications')]);
  }
  if (ids('disciplinary_appeals').length) {
    await run('disciplinary_appeals', `DELETE FROM disciplinary_appeals WHERE id_disciplinary_appeals IN (?)`, [
      ids('disciplinary_appeals'),
    ]);
  }
  if (ids('disciplinary_notifications').length) {
    await run(
      'disciplinary_notifications',
      `DELETE FROM disciplinary_notifications WHERE id_disciplinary_notifications IN (?)`,
      [ids('disciplinary_notifications')],
    );
  }
  if (ids('disciplinary_defenses').length) {
    await run('disciplinary_defenses', `DELETE FROM disciplinary_defenses WHERE id_disciplinary_defenses IN (?)`, [
      ids('disciplinary_defenses'),
    ]);
  }
  if (ids('disciplinary_communications').length) {
    await run(
      'disciplinary_communications',
      `DELETE FROM disciplinary_communications WHERE id_disciplinary_communications IN (?)`,
      [ids('disciplinary_communications')],
    );
  }
  if (ids('disciplinary_case_events').length) {
    await run('disciplinary_case_events', `DELETE FROM disciplinary_case_events WHERE id_disciplinary_case_events IN (?)`, [
      ids('disciplinary_case_events'),
    ]);
  }
  if (ids('disciplinary_cases').length) {
    await run('disciplinary_cases', `DELETE FROM disciplinary_cases WHERE id_disciplinary_cases IN (?)`, [
      ids('disciplinary_cases'),
    ]);
  }
  if (ids('disciplinary_infraction_types').length) {
    await run(
      'disciplinary_infraction_types',
      `DELETE FROM disciplinary_infraction_types WHERE id_disciplinary_infraction_types IN (?)`,
      [ids('disciplinary_infraction_types')],
    ]);
  }
  if (ids('absenteeism_alert_notifications').length) {
    await run(
      'absenteeism_alert_notifications',
      `DELETE FROM absenteeism_alert_notifications WHERE id_absenteeism_alert_notifications IN (?)`,
      [ids('absenteeism_alert_notifications')],
    ]);
  }
  if (ids('absenteeism_alerts').length) {
    await run('absenteeism_alerts', `DELETE FROM absenteeism_alerts WHERE id_absenteeism_alerts IN (?)`, [
      ids('absenteeism_alerts'),
    ]);
  }
  if (ids('justification_evidences').length) {
    await run(
      'justification_evidences',
      `DELETE FROM justification_evidences WHERE id_justification_evidences IN (?)`,
      [ids('justification_evidences')],
    ]);
  }
  if (ids('absence_justifications').length) {
    await run(
      'absence_justifications',
      `DELETE FROM absence_justifications WHERE id_absence_justifications IN (?)`,
      [ids('absence_justifications')],
    ]);
  }
  if (ids('attendance').length) {
    await run('attendance', `DELETE FROM attendance WHERE id_attendance IN (?)`, [ids('attendance')]);
  }
  if (ids('attendance_sessions').length) {
    await run('attendance_sessions', `DELETE FROM attendance_sessions WHERE id_attendance_sessions IN (?)`, [
      ids('attendance_sessions'),
    ]);
  }
  if (ids('schedule_entries').length) {
    await run('schedule_entries', `DELETE FROM schedule_entries WHERE id_schedule_entries IN (?)`, [
      ids('schedule_entries'),
    ]);
  }
  if (ids('teaching_assignments').length) {
    await run('teaching_assignments', `DELETE FROM teaching_assignments WHERE id_teaching_assignments IN (?)`, [
      ids('teaching_assignments'),
    ]);
  }
  if (ids('guardian_student_links').length) {
    await run(
      'guardian_student_links',
      `DELETE FROM guardian_student_links WHERE id_guardian_student_links IN (?)`,
      [ids('guardian_student_links')],
    ]);
  }
  if (ids('group_enrollments').length) {
    await run('group_enrollments', `DELETE FROM group_enrollments WHERE id_group_enrollments IN (?)`, [
      ids('group_enrollments'),
    ]);
  }
  const seedUserIds = ids('users');
  if (seedUserIds.length) {
    if (!dryRun && manifest.nationalIds?.length) {
      const [rows] = await conn.query(`SELECT id_users AS id, national_id FROM users WHERE id_users IN (?)`, [
        seedUserIds,
      ]);
      const prefix = manifest.nationalIdPrefix ?? '801099';
      const foreign = rows.filter((r) => !String(r.national_id).replace(/\D/g, '').startsWith(prefix));
      if (foreign.length) {
        throw new Error(
          'Rollback abortado: el manifiesto incluye usuarios fuera del prefijo sintético reservado.',
        );
      }
    }
    await run('user_roles (seed)', `DELETE FROM user_roles WHERE id_users IN (?)`, [seedUserIds]);
    await run('users (seed)', `DELETE FROM users WHERE id_users IN (?)`, [seedUserIds]);
  }
  if (ids('groups').length) {
    await run('groups', `DELETE FROM groups WHERE id_groups IN (?)`, [ids('groups')]);
  }
  if (ids('sections').length) {
    await run('sections', `DELETE FROM sections WHERE id_sections IN (?)`, [ids('sections')]);
  }
  if (ids('subjects').length) {
    await run('subjects', `DELETE FROM subjects WHERE id_subjects IN (?)`, [ids('subjects')]);
  }
  if (ids('specialties').length) {
    await run('specialties', `DELETE FROM specialties WHERE id_specialties IN (?)`, [ids('specialties')]);
  }
  if (ids('academic_periods').length) {
    await run('academic_periods', `DELETE FROM academic_periods WHERE id_academic_periods IN (?)`, [
      ids('academic_periods'),
    ]);
  }
  if (ids('academic_years').length) {
    await run('academic_years', `DELETE FROM academic_years WHERE id_academic_years IN (?)`, [
      ids('academic_years'),
    ]);
  }

  return { steps: steps.length, dryRun };
}
