import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

/**
 * Helper para inserciones idempotentes.
 * Ejecuta el query y captura errores de duplicado (ER_DUP_ENTRY)
 */
async function insertIgnore(connection, query, params) {
  try {
    const [result] = await connection.query(query, params);
    return result;
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return null;
    }
    throw error;
  }
}

async function main() {
  const isReset = process.argv.includes('--reset');

  console.log('--- Iniciando Seed de Datos Demo ---');
  if (isReset) {
    console.log('[!] Modo RESET activado. Se limpiarán los datos transaccionales previos...');
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  try {
    // 1.3 Hash de contraseña precomputado
    const passwordHash = await bcrypt.hash('TempPass12', 10);
    console.log('[✓] Contraseña "TempPass12" precomputada.');

    if (isReset) {
      console.log('Limpiando datos transaccionales previos...');
      
      // Delete in reverse order
      await connection.query(`DELETE FROM absenteeism_alerts WHERE idempotency_key LIKE 'demo_alert_%'`);
      await connection.query(`DELETE e FROM justification_evidences e JOIN absence_justifications j ON e.id_absence_justifications = j.id_absence_justifications WHERE j.reason = 'Cita médica (Demo)'`);
      await connection.query(`DELETE FROM absence_justifications WHERE reason = 'Cita médica (Demo)'`);
      
      // Delete attendance created by docGuia (whose email is docente.guia@edusmart.test)
      const [demoUsers] = await connection.query(`SELECT id_users AS id FROM users WHERE email LIKE '%@edusmart.test'`);
      const demoUserIds = demoUsers.map(u => u.id);
      if (demoUserIds.length > 0) {
        await connection.query(`DELETE FROM attendance WHERE id_users_student IN (?)`, [demoUserIds]);
        await connection.query(`DELETE FROM attendance_sessions WHERE id_users_created_by IN (?)`, [demoUserIds]);
        await connection.query(`DELETE FROM schedule_entries WHERE id_teaching_assignments IN (SELECT id_teaching_assignments FROM teaching_assignments WHERE id_users IN (?))`, [demoUserIds]);
        await connection.query(`DELETE FROM guardian_student_links WHERE id_users_guardian IN (?) OR id_users_student IN (?)`, [demoUserIds, demoUserIds]);
        await connection.query(`DELETE FROM group_enrollments WHERE id_users IN (?)`, [demoUserIds]);
        await connection.query(`DELETE FROM teaching_assignments WHERE id_users IN (?)`, [demoUserIds]);
        await connection.query(`DELETE FROM user_roles WHERE id_users IN (?)`, [demoUserIds]);
        await connection.query(`DELETE FROM users WHERE id_users IN (?)`, [demoUserIds]);
      }
      
      console.log('[✓] Limpieza completada.');
    }

    console.log('--- 2. Estructura Académica y Asignaturas ---');
    
    // Auto-cleanup of duplicates (in case they were generated previously)
    try {
      await connection.query(`DELETE t1 FROM academic_periods t1 JOIN academic_periods t2 ON t1.name = t2.name AND t1.id_academic_periods > t2.id_academic_periods`);
      await connection.query(`DELETE t1 FROM academic_years t1 JOIN academic_years t2 ON t1.name = t2.name AND t1.id_academic_years > t2.id_academic_years`);
      await connection.query(`DELETE t1 FROM \`groups\` t1 JOIN \`groups\` t2 ON t1.name = t2.name AND t1.id_groups > t2.id_groups`);
      await connection.query(`DELETE t1 FROM specialties t1 JOIN specialties t2 ON t1.name = t2.name AND t1.id_specialties > t2.id_specialties`);
      await connection.query(`DELETE t1 FROM sections t1 JOIN sections t2 ON t1.name = t2.name AND t1.id_sections > t2.id_sections`);
    } catch (cleanupErr) {
      // Ignorar si hay constraint error, solo borramos los que se pueden
    }

    // 2.1 Año lectivo y periodo
    await connection.query(`
      INSERT INTO academic_years (name, start_date, end_date, status, created_at, updated_at)
      SELECT '2026', '2026-02-01', '2026-12-15', 'ACTIVE', NOW(), NOW()
      WHERE NOT EXISTS (SELECT 1 FROM academic_years WHERE name = '2026')
    `);
    const [years] = await connection.query(`SELECT id_academic_years AS id FROM academic_years WHERE name='2026' LIMIT 1`);
    const yearId = years[0].id;

    await connection.query(`
      INSERT INTO academic_periods (id_academic_years, name, start_date, end_date, status, created_at, updated_at)
      SELECT ?, 'I Semestre 2026', '2026-02-01', '2026-06-30', 'ACTIVE', NOW(), NOW()
      WHERE NOT EXISTS (SELECT 1 FROM academic_periods WHERE name = 'I Semestre 2026' AND id_academic_years = ?)
    `, [yearId, yearId]);
    const [periods] = await connection.query(`SELECT id_academic_periods AS id FROM academic_periods WHERE name='I Semestre 2026' LIMIT 1`);
    const periodId = periods[0].id;

    // Especialidades Técnicas
    await connection.query(`
      INSERT INTO specialties (name, description, status, kind, created_at, updated_at)
      SELECT 'Informática Empresarial', 'Desarrollo de software y redes', 'ACTIVE', 'TECHNICAL_SPECIALTY', NOW(), NOW()
      WHERE NOT EXISTS (SELECT 1 FROM specialties WHERE name = 'Informática Empresarial')
    `);
    await connection.query(`
      INSERT INTO specialties (name, description, status, kind, created_at, updated_at)
      SELECT 'Contabilidad', 'Finanzas y contabilidad', 'ACTIVE', 'TECHNICAL_SPECIALTY', NOW(), NOW()
      WHERE NOT EXISTS (SELECT 1 FROM specialties WHERE name = 'Contabilidad')
    `);
    const [specInfoRows] = await connection.query(`SELECT id_specialties AS id FROM specialties WHERE name='Informática Empresarial' LIMIT 1`);
    const infoSpecialtyId = specInfoRows[0].id;

    // 2.2 Secciones
    const sections = [
      { name: '10° Año', grade: 10, desc: 'Décimo año general' },
      { name: '11° Año INFO', grade: 11, desc: 'Undécimo año Informática', specId: infoSpecialtyId },
      { name: '12° Año INFO', grade: 12, desc: 'Duodécimo año Informática', specId: infoSpecialtyId }
    ];
    for (const s of sections) {
      await insertIgnore(connection, `
        INSERT INTO sections (name, grade_level, description, id_academic_periods, id_specialties, status, created_at, updated_at)
        SELECT ?, ?, ?, ?, ?, 'ACTIVE', NOW(), NOW()
        WHERE NOT EXISTS (SELECT 1 FROM sections WHERE name = ? AND id_academic_periods = ?)
      `, [s.name, s.grade, s.desc, periodId, s.specId || null, s.name, periodId]);
    }
    const [sec10] = await connection.query(`SELECT id_sections AS id FROM sections WHERE name='10° Año' AND id_academic_periods=?`, [periodId]);
    const [sec11] = await connection.query(`SELECT id_sections AS id FROM sections WHERE name='11° Año INFO' AND id_academic_periods=?`, [periodId]);
    const [sec12] = await connection.query(`SELECT id_sections AS id FROM sections WHERE name='12° Año INFO' AND id_academic_periods=?`, [periodId]);

    // Grupos
    const groups = [
      { name: '10-1', max: 30, secId: sec10[0].id },
      { name: '10-2', max: 30, secId: sec10[0].id },
      { name: '11-INFO-1', max: 25, secId: sec11[0].id, specId: infoSpecialtyId },
      { name: '12-INFO-1', max: 25, secId: sec12[0].id, specId: infoSpecialtyId }
    ];
    for (const g of groups) {
      await connection.query(`
        INSERT INTO \`groups\` (name, max_capacity, student_count, id_sections, id_specialties, id_academic_periods, status, created_at, updated_at)
        SELECT ?, ?, 0, ?, ?, ?, 'ACTIVE', NOW(), NOW()
        WHERE NOT EXISTS (SELECT 1 FROM \`groups\` WHERE name = ? AND id_academic_periods = ?)
      `, [g.name, g.max, g.secId, g.specId || null, periodId, g.name, periodId]);
    }
    const [grp101] = await connection.query(`SELECT id_groups AS id FROM \`groups\` WHERE name='10-1' AND id_sections=?`, [sec10[0].id]);
    const [grp11] = await connection.query(`SELECT id_groups AS id FROM \`groups\` WHERE name='11-INFO-1' AND id_sections=?`, [sec11[0].id]);

    // 2.3 Asignaturas (Subjects)
    const subjects = [
      { name: 'Matemáticas', code: 'MATH' },
      { name: 'Español', code: 'SPAN' },
      { name: 'Programación', code: 'PROG' },
      { name: 'Redes', code: 'NETW' }
    ];
    for (const sub of subjects) {
      await insertIgnore(connection, `
        INSERT INTO subjects (name, code, status, created_at, updated_at)
        VALUES (?, ?, 'ACTIVE', NOW(), NOW())
      `, [sub.name, sub.code]);
    }
    const [subMath] = await connection.query(`SELECT id_subjects AS id FROM subjects WHERE name='Matemáticas' LIMIT 1`);
    const [subProg] = await connection.query(`SELECT id_subjects AS id FROM subjects WHERE name='Programación' LIMIT 1`);

    console.log('[✓] Estructura Académica y Asignaturas sembradas.');

    console.log('--- 3. Usuarios, Roles y Matrículas ---');

    // Roles
    const [roles] = await connection.query(`SELECT id_roles AS id, name FROM roles`);
    const roleByName = Object.fromEntries(roles.map(r => [r.name, r.id]));
    
    async function ensureUser(nationalId, name, last, email, roleName) {
      let [u] = await connection.query(`SELECT id_users AS id FROM users WHERE national_id=? LIMIT 1`, [nationalId]);
      if (!u.length) {
        const [r] = await connection.query(`
          INSERT INTO users (national_id, name, first_lastname, email, password_hash, status, must_change_password, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 'ACTIVE', 0, NOW(), NOW())
        `, [nationalId, name, last, email, passwordHash]);
        u = [{ id: r.insertId }];
      } else {
        await connection.query(`
          UPDATE users 
          SET name=?, first_lastname=?, email=?, password_hash=?, status='ACTIVE' 
          WHERE id_users=?
        `, [name, last, email, passwordHash, u[0].id]);
      }
      
      const roleId = roleByName[roleName];
      if (roleId) {
        await insertIgnore(connection, `
          INSERT INTO user_roles (id_users, id_roles, assigned_at) VALUES (?, ?, NOW())
        `, [u[0].id, roleId]);
      }
      return u[0].id;
    }

    // 3.1 Usuarios
    const docGuiaId = await ensureUser('300000010', 'María', 'Fernández', 'mfernandez@edusmart.test', 'Docente');
    const docTecId = await ensureUser('300000011', 'Carlos', 'Mora', 'cmora@edusmart.test', 'Docente');
    
    const estRegId = await ensureUser('300000020', 'Diego', 'Rojas', 'drojas@edusmart.test', 'Estudiante');
    const estJustId = await ensureUser('300000021', 'Laura', 'Vargas', 'lvargas@edusmart.test', 'Estudiante');
    const estRiesgoId = await ensureUser('300000022', 'Kevin', 'Salazar', 'ksalazar@edusmart.test', 'Estudiante');
    
    const encargadoId = await ensureUser('300000030', 'Roberto', 'Rojas', 'rrojas@edusmart.test', 'Encargado');

    // 3.2 Asignaciones académicas
    async function assignTeacher(userId, groupId, periodId, isGuide, offeringKind, subjectId, specId) {
      const fingerprint = `${userId}:${groupId}:${offeringKind || ''}:${subjectId || 0}:${specId || 0}:${periodId}`;
      await insertIgnore(connection, `
        INSERT INTO teaching_assignments 
        (id_users, id_groups, id_academic_periods, is_guide_teacher, offering_kind, id_subjects, id_specialties, assignment_fingerprint, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [userId, groupId, periodId, isGuide ? 1 : 0, offeringKind, subjectId, specId, fingerprint]);
      
      const [ta] = await connection.query(`SELECT id_teaching_assignments AS id FROM teaching_assignments WHERE assignment_fingerprint=?`, [fingerprint]);
      if (!ta || ta.length === 0) {
        throw new Error(`Teaching assignment not found after insert/ignore for fingerprint: ${fingerprint}`);
      }
      return ta[0].id;
    }

    const taGuia101 = await assignTeacher(docGuiaId, grp101[0].id, periodId, true, null, null, null); // Guía de 10-1
    const taMath101 = await assignTeacher(docGuiaId, grp101[0].id, periodId, false, 'SUBJECT', subMath[0].id, null); // Da Mate a 10-1
    const taProg11 = await assignTeacher(docTecId, grp11[0].id, periodId, false, 'TECHNICAL_SPECIALTY', subProg[0].id, infoSpecialtyId); // Da Prog a 11-INFO-1

    // 3.3 Matrículas
    async function enrollStudent(userId, groupId, periodId) {
      await insertIgnore(connection, `
        INSERT INTO group_enrollments (id_users, id_groups, id_academic_periods, starts_on, status, created_at, updated_at)
        VALUES (?, ?, ?, '2026-02-01', 'ACTIVE', NOW(), NOW())
      `, [userId, groupId, periodId]);
    }
    await enrollStudent(estRegId, grp101[0].id, periodId);
    await enrollStudent(estJustId, grp101[0].id, periodId);
    await enrollStudent(estRiesgoId, grp101[0].id, periodId);

    // Actualizar student_count
    await connection.query(`
      UPDATE \`groups\` g 
      SET student_count = (
        SELECT COUNT(*) FROM group_enrollments e WHERE e.id_groups = g.id_groups AND e.status = 'ACTIVE'
      )
    `);

    // 3.4 Vínculos encargado
    await insertIgnore(connection, `
      INSERT INTO guardian_student_links (id_users_guardian, id_users_student, relationship, created_at)
      VALUES (?, ?, 'FATHER', NOW())
    `, [encargadoId, estRegId]);
    await insertIgnore(connection, `
      INSERT INTO guardian_student_links (id_users_guardian, id_users_student, relationship, created_at)
      VALUES (?, ?, 'FATHER', NOW())
    `, [encargadoId, estRiesgoId]);

    console.log('[✓] Usuarios, Roles y Matrículas sembradas.');

    console.log('--- 4. Horarios, Asistencias y Alertas ---');

    // 4.1 Horarios
    const [slots] = await connection.query(`SELECT id_schedule_time_slots AS id FROM schedule_time_slots LIMIT 5`);
    if (slots.length >= 2) {
      // 2 lecciones para taMath101
      await insertIgnore(connection, `
        INSERT INTO schedule_entries (id_teaching_assignments, id_schedule_time_slots, day_of_week, room, created_at, updated_at)
        VALUES (?, ?, 'MONDAY', 'A-101', NOW(), NOW())
      `, [taMath101, slots[0].id]);
      await insertIgnore(connection, `
        INSERT INTO schedule_entries (id_teaching_assignments, id_schedule_time_slots, day_of_week, room, created_at, updated_at)
        VALUES (?, ?, 'TUESDAY', 'A-101', NOW(), NOW())
      `, [taMath101, slots[1].id]);
      
      // 2 lecciones para taProg11
      await insertIgnore(connection, `
        INSERT INTO schedule_entries (id_teaching_assignments, id_schedule_time_slots, day_of_week, room, created_at, updated_at)
        VALUES (?, ?, 'WEDNESDAY', 'LAB-1', NOW(), NOW())
      `, [taProg11, slots[0].id]);
      await insertIgnore(connection, `
        INSERT INTO schedule_entries (id_teaching_assignments, id_schedule_time_slots, day_of_week, room, created_at, updated_at)
        VALUES (?, ?, 'THURSDAY', 'LAB-1', NOW(), NOW())
      `, [taProg11, slots[1].id]);
    }
    
    // Obtener un entry para la asistencia
    const [mathEntries] = await connection.query(`SELECT id_schedule_entries AS id FROM schedule_entries WHERE id_teaching_assignments=? LIMIT 1`, [taMath101]);
    const mathEntryId = mathEntries[0]?.id || null;

    // 4.2 Asistencia
    const today = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);
    
    // Crear sesión cerrada
    await insertIgnore(connection, `
      INSERT INTO attendance_sessions (id_teaching_assignments, id_schedule_entries, session_date, started_at, closed_at, status, id_users_created_by, created_at, updated_at)
      VALUES (?, ?, ?, NOW(), NOW(), 'CLOSED', ?, NOW(), NOW())
    `, [taMath101, mathEntryId, lastWeek.toISOString().split('T')[0], docGuiaId]);
    const [sessions] = await connection.query(`SELECT id_attendance_sessions AS id FROM attendance_sessions WHERE id_teaching_assignments=? ORDER BY id_attendance_sessions DESC LIMIT 1`, [taMath101]);
    const sessionId = sessions[0].id;

    async function markAttendance(studentId, status, justStatus) {
      await insertIgnore(connection, `
        INSERT INTO attendance (id_attendance_sessions, id_users_student, status, justification_status, registration_method, registered_at, id_users_registered_by, updated_at)
        VALUES (?, ?, ?, ?, 'MANUAL', NOW(), ?, NOW())
      `, [sessionId, studentId, status, justStatus, docGuiaId]);
      const [att] = await connection.query(`SELECT id_attendance AS id FROM attendance WHERE id_attendance_sessions=? AND id_users_student=?`, [sessionId, studentId]);
      return att[0].id;
    }

    await markAttendance(estRegId, 'PRESENT', 'NONE');
    const attJustId = await markAttendance(estJustId, 'ABSENT', 'JUSTIFIED');
    await markAttendance(estRiesgoId, 'ABSENT', 'NONE');

    // 4.3 Justificaciones
    await insertIgnore(connection, `
      INSERT INTO absence_justifications (id_attendance, reason, status, id_users_reviewed_by, reviewed_at, id_users_created_by, created_at)
      VALUES (?, 'Cita médica (Demo)', 'APPROVED', ?, NOW(), ?, NOW())
    `, [attJustId, docGuiaId, estJustId]);
    const [justs] = await connection.query(`SELECT id_absence_justifications AS id FROM absence_justifications WHERE id_attendance=?`, [attJustId]);
    
    await insertIgnore(connection, `
      INSERT INTO justification_evidences (id_absence_justifications, file_name, storage_path, mime_type, file_size_bytes, id_users_uploaded_by, created_at)
      VALUES (?, 'receta_demo.pdf', 's3://demo/receta_demo.pdf', 'application/pdf', 1024, ?, NOW())
    `, [justs[0].id, estJustId]);

    // 4.4 Alertas de ausentismo
    const alertIdempotency = `demo_alert_${estRiesgoId}_${periodId}`;
    await insertIgnore(connection, `
      INSERT INTO absenteeism_alerts (id_users_student, id_groups, risk_level, status, rule_codes, unjustified_absences_month, absences_period, consecutive_absences, attendance_percent, window_start, window_end, idempotency_key, triggered_at, updated_at)
      VALUES (?, ?, 'MEDIUM', 'NEW', '["CONSECUTIVE_ABSENCES"]', 3, 5, 3, 85.5, '2026-02-01', '2026-02-28', ?, NOW(), NOW())
    `, [estRiesgoId, grp101[0].id, alertIdempotency]);

    console.log('[✓] Horarios, Asistencias y Alertas sembradas.');

    console.log('\\n======================================================');
    console.log('   SEMILLERO DE DATOS DEMO COMPLETADO CON ÉXITO');
    console.log('======================================================');
    console.log('Credenciales de prueba generadas (Contraseña para todos: TempPass12):');
    console.table([
      { Rol: 'Docente Guía', Nombre: 'María Fernández', Cédula: '300000010', Email: 'mfernandez@edusmart.test' },
      { Rol: 'Docente Técnico', Nombre: 'Carlos Mora', Cédula: '300000011', Email: 'cmora@edusmart.test' },
      { Rol: 'Estudiante Regular', Nombre: 'Diego Rojas', Cédula: '300000020', Email: 'drojas@edusmart.test' },
      { Rol: 'Estudiante (Justificado)', Nombre: 'Laura Vargas', Cédula: '300000021', Email: 'lvargas@edusmart.test' },
      { Rol: 'Estudiante (En Riesgo)', Nombre: 'Kevin Salazar', Cédula: '300000022', Email: 'ksalazar@edusmart.test' },
      { Rol: 'Encargado (Padre)', Nombre: 'Roberto Rojas', Cédula: '300000030', Email: 'rrojas@edusmart.test' }
    ]);
    console.log('======================================================\\n');
  } catch (e) {
    console.error('Error durante el seed:', e);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
