import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { DepartureHistoryFilterDto } from '../dto/departure-history-filter.dto';
import { DepartureStatus, DepartureType } from '../entities/student-departure.entity';
import { ScheduledPermitStatus } from '../entities/scheduled-departure-permit.entity';
import {
  DepartureHistoryItem,
  RegisteredGuardian,
  ScheduledPermitView,
  StudentSummary,
} from '../interfaces/departures.interface';
import { costaRicaRangeBounds } from '../utils/costa-rica-time';
import { fullName, maskNationalId, relationshipLabel } from '../utils/identity';

const STUDENT_ROLE_NAMES = ['Estudiante', 'STUDENT'];

/**
 * Sección vigente de cada estudiante: su matrícula ACTIVE más reciente.
 * Se usa como subconsulta para no disparar una consulta por fila (N+1).
 */
const CURRENT_GROUP_JOIN = `
  LEFT JOIN (
    SELECT ge.id_users, MAX(ge.id_group_enrollments) AS id_enrollment
    FROM group_enrollments ge
    WHERE ge.status = 'ACTIVE'
    GROUP BY ge.id_users
  ) cur ON cur.id_users = st.id_users
  LEFT JOIN group_enrollments cge ON cge.id_group_enrollments = cur.id_enrollment
  LEFT JOIN \`groups\` g ON g.id_groups = cge.id_groups
  LEFT JOIN sections s ON s.id_sections = g.id_sections
`;

interface StudentRow {
  id: number;
  name: string;
  first_lastname: string | null;
  second_lastname: string | null;
  national_id: string;
  group_id: number | null;
  group_name: string | null;
  section_name: string | null;
}

interface HistoryRow extends StudentRow {
  departure_id: string;
  departure_time: Date;
  status: DepartureStatus;
  departure_type: DepartureType;
  justification_reason: string | null;
  relationship: string | null;
  guardian_identifier: string | null;
  scheduled_permit_id: string | null;
  guardian_id: number | null;
  guardian_name: string | null;
  guardian_first_lastname: string | null;
  guardian_second_lastname: string | null;
  guard_id: number;
  guard_name: string;
  guard_first_lastname: string | null;
  guard_second_lastname: string | null;
}

interface PermitRow extends StudentRow {
  permit_id: string;
  permit_date: string;
  permit_time: string;
  reason: string;
  permit_status: ScheduledPermitStatus;
  completed_at: Date | null;
  created_at: Date;
  authorized_by_id: number;
  auth_name: string;
  auth_first_lastname: string | null;
  auth_second_lastname: string | null;
}

function toStudent(row: StudentRow): StudentSummary {
  return {
    id: Number(row.id),
    fullName: fullName(row.name, row.first_lastname, row.second_lastname),
    nationalId: row.national_id,
    groupId: row.group_id === null || row.group_id === undefined ? null : Number(row.group_id),
    groupName: row.group_name ?? null,
    sectionName: row.section_name ?? null,
  };
}

@Injectable()
export class DeparturesRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private runner(manager?: EntityManager) {
    return manager ?? this.dataSource;
  }

  /** Estudiante activo por cédula (sin guiones) o por ID interno. */
  async findActiveStudent(
    identifier: string,
    manager?: EntityManager,
  ): Promise<StudentSummary | null> {
    const raw = identifier.trim();
    const digits = raw.replace(/\D/g, '');
    const byId = /^\d{1,8}$/.test(raw) ? Number(raw) : -1;
    const rows: StudentRow[] = await this.runner(manager).query(
      `SELECT st.id_users AS id, st.name, st.first_lastname, st.second_lastname, st.national_id,
              g.id_groups AS group_id, g.name AS group_name, s.name AS section_name
       FROM users st
       ${CURRENT_GROUP_JOIN}
       WHERE st.status = 'ACTIVE'
         AND (REPLACE(REPLACE(st.national_id, '-', ''), ' ', '') = ? OR st.id_users = ?)
         AND EXISTS (
           SELECT 1 FROM user_roles ur INNER JOIN roles r ON r.id_roles = ur.id_roles
           WHERE ur.id_users = st.id_users AND r.name IN (?)
         )
       ORDER BY (REPLACE(REPLACE(st.national_id, '-', ''), ' ', '') = ?) DESC
       LIMIT 1`,
      [digits || raw, byId, STUDENT_ROLE_NAMES, digits || raw],
    );
    return rows[0] ? toStudent(rows[0]) : null;
  }

  async findStudentById(
    studentId: number,
    manager?: EntityManager,
  ): Promise<StudentSummary | null> {
    const rows: StudentRow[] = await this.runner(manager).query(
      `SELECT st.id_users AS id, st.name, st.first_lastname, st.second_lastname, st.national_id,
              g.id_groups AS group_id, g.name AS group_name, s.name AS section_name
       FROM users st
       ${CURRENT_GROUP_JOIN}
       WHERE st.id_users = ?
       LIMIT 1`,
      [studentId],
    );
    return rows[0] ? toStudent(rows[0]) : null;
  }

  /** Encargados registrados (guardian_student_links) con su cédula sin enmascarar. */
  async findLinkedGuardians(
    studentId: number,
    manager?: EntityManager,
  ): Promise<Array<RegisteredGuardian & { nationalId: string }>> {
    const rows: Array<{
      id: number;
      name: string;
      first_lastname: string | null;
      second_lastname: string | null;
      national_id: string;
      status: string;
      relationship: string | null;
    }> = await this.runner(manager).query(
      `SELECT u.id_users AS id, u.name, u.first_lastname, u.second_lastname, u.national_id,
              u.status, gsl.relationship
       FROM guardian_student_links gsl
       INNER JOIN users u ON u.id_users = gsl.id_users_guardian
       WHERE gsl.id_users_student = ?
       ORDER BY u.name ASC`,
      [studentId],
    );
    return rows.map((row) => ({
      id: Number(row.id),
      fullName: fullName(row.name, row.first_lastname, row.second_lastname),
      nationalId: row.national_id,
      nationalIdMasked: maskNationalId(row.national_id),
      relationship: relationshipLabel(row.relationship),
      active: row.status === 'ACTIVE',
    }));
  }

  /** Usuario (cualquiera) con esa cédula, para dejar rastro en intentos denegados. */
  async findUserIdByNationalId(
    nationalId: string,
    manager?: EntityManager,
  ): Promise<number | null> {
    const rows: Array<{ id: number }> = await this.runner(manager).query(
      `SELECT id_users AS id FROM users WHERE REPLACE(REPLACE(national_id, '-', ''), ' ', '') = ? LIMIT 1`,
      [nationalId],
    );
    return rows[0] ? Number(rows[0].id) : null;
  }

  async findLastAuthorizedBetween(
    studentId: number,
    start: Date,
    end: Date,
  ): Promise<{ id: string; departureTime: Date } | null> {
    const rows: Array<{ id: string; departure_time: Date }> = await this.dataSource.query(
      `SELECT id, departure_time FROM student_departures
       WHERE student_id = ? AND status = 'AUTHORIZED' AND departure_time >= ? AND departure_time < ?
       ORDER BY departure_time DESC LIMIT 1`,
      [studentId, start, end],
    );
    return rows[0] ? { id: rows[0].id, departureTime: rows[0].departure_time } : null;
  }

  async countTodayKpis(start: Date, end: Date, todayDate: string) {
    const [row]: Array<{
      total: string | null;
      early: string | null;
      emergency: string | null;
      denied: string | null;
    }> = await this.dataSource.query(
      `SELECT
         SUM(CASE WHEN status = 'AUTHORIZED' THEN 1 ELSE 0 END) AS total,
         SUM(CASE WHEN status = 'AUTHORIZED' AND departure_type = 'EARLY' THEN 1 ELSE 0 END) AS early,
         SUM(CASE WHEN status = 'AUTHORIZED' AND departure_type = 'EMERGENCY' THEN 1 ELSE 0 END) AS emergency,
         SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) AS denied
       FROM student_departures
       WHERE departure_time >= ? AND departure_time < ?`,
      [start, end],
    );
    const [permits]: Array<{ pending: string }> = await this.dataSource.query(
      `SELECT COUNT(*) AS pending FROM scheduled_departure_permits
       WHERE permit_date = ? AND status = 'PENDING'`,
      [todayDate],
    );
    return {
      totalDepartures: Number(row?.total ?? 0),
      earlyDepartures: Number(row?.early ?? 0),
      emergencyDepartures: Number(row?.emergency ?? 0),
      deniedAttempts: Number(row?.denied ?? 0),
      pendingPermits: Number(permits?.pending ?? 0),
    };
  }

  private buildHistoryWhere(filter: DepartureHistoryFilterDto): { sql: string; params: unknown[] } {
    const clauses: string[] = [];
    const params: unknown[] = [];
    const { start, end } = costaRicaRangeBounds(filter.startDate, filter.endDate);
    if (start) {
      clauses.push('d.departure_time >= ?');
      params.push(start);
    }
    if (end) {
      clauses.push('d.departure_time < ?');
      params.push(end);
    }
    if (filter.since) {
      clauses.push('d.departure_time >= ?');
      params.push(new Date(filter.since));
    }
    if (filter.status) {
      clauses.push('d.status = ?');
      params.push(filter.status);
    }
    if (filter.departureType) {
      clauses.push('d.departure_type = ?');
      params.push(filter.departureType);
    }
    if (filter.studentId) {
      clauses.push('d.student_id = ?');
      params.push(filter.studentId);
    }
    if (filter.groupId) {
      clauses.push('g.id_groups = ?');
      params.push(filter.groupId);
    }
    if (filter.search?.trim()) {
      const term = filter.search.trim();
      const digits = term.replace(/\D/g, '');
      clauses.push(
        `(CONCAT_WS(' ', st.name, st.first_lastname, st.second_lastname) LIKE ?${
          digits ? ` OR REPLACE(REPLACE(st.national_id, '-', ''), ' ', '') LIKE ?` : ''
        })`,
      );
      params.push(`%${term}%`);
      if (digits) params.push(`%${digits}%`);
    }
    return { sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
  }

  private static readonly HISTORY_FROM = `
    FROM student_departures d
    INNER JOIN users st ON st.id_users = d.student_id
    LEFT JOIN users gu ON gu.id_users = d.guardian_id
    INNER JOIN users sg ON sg.id_users = d.security_guard_id
    ${CURRENT_GROUP_JOIN}
  `;

  async findHistory(
    filter: DepartureHistoryFilterDto,
    pagination: { limit: number; offset: number } | null,
  ): Promise<{ items: DepartureHistoryItem[]; total: number }> {
    const where = this.buildHistoryWhere(filter);
    const [countRow]: Array<{ total: string }> = await this.dataSource.query(
      `SELECT COUNT(*) AS total ${DeparturesRepository.HISTORY_FROM} ${where.sql}`,
      where.params,
    );
    const limitSql = pagination ? 'LIMIT ? OFFSET ?' : 'LIMIT 5000';
    const rows: HistoryRow[] = await this.dataSource.query(
      `SELECT d.id AS departure_id, d.departure_time, d.status, d.departure_type,
              d.justification_reason, d.relationship, d.guardian_identifier, d.scheduled_permit_id,
              st.id_users AS id, st.name, st.first_lastname, st.second_lastname, st.national_id,
              g.id_groups AS group_id, g.name AS group_name, s.name AS section_name,
              gu.id_users AS guardian_id, gu.name AS guardian_name,
              gu.first_lastname AS guardian_first_lastname, gu.second_lastname AS guardian_second_lastname,
              sg.id_users AS guard_id, sg.name AS guard_name,
              sg.first_lastname AS guard_first_lastname, sg.second_lastname AS guard_second_lastname
       ${DeparturesRepository.HISTORY_FROM}
       ${where.sql}
       ORDER BY d.departure_time DESC, d.created_at DESC, d.id DESC
       ${limitSql}`,
      pagination ? [...where.params, pagination.limit, pagination.offset] : where.params,
    );

    const items: DepartureHistoryItem[] = rows.map((row) => ({
      id: row.departure_id,
      departureTime: row.departure_time,
      status: row.status,
      departureType: row.departure_type,
      justificationReason: row.justification_reason,
      relationship: relationshipLabel(row.relationship),
      guardianIdentifierMasked: row.guardian_identifier
        ? maskNationalId(row.guardian_identifier)
        : null,
      // El parentesco solo se guarda cuando el encargado estaba vinculado.
      guardianLinked: row.status === DepartureStatus.AUTHORIZED || row.relationship !== null,
      scheduledPermitId: row.scheduled_permit_id,
      student: toStudent(row),
      guardian:
        row.guardian_id === null || row.guardian_id === undefined
          ? null
          : {
              id: Number(row.guardian_id),
              fullName: fullName(
                row.guardian_name,
                row.guardian_first_lastname,
                row.guardian_second_lastname,
              ),
            },
      securityGuard: {
        id: Number(row.guard_id),
        fullName: fullName(row.guard_name, row.guard_first_lastname, row.guard_second_lastname),
      },
    }));

    return { items, total: Number(countRow?.total ?? 0) };
  }

  /** Secciones activas para el filtro de la bitácora. */
  async findActiveGroups(): Promise<
    Array<{ id: number; name: string; sectionName: string | null }>
  > {
    const rows: Array<{ id: number; name: string; section_name: string | null }> =
      await this.dataSource.query(
        `SELECT g.id_groups AS id, g.name, s.name AS section_name
       FROM \`groups\` g
       LEFT JOIN sections s ON s.id_sections = g.id_sections
       WHERE g.status = 'ACTIVE'
       ORDER BY s.grade_level ASC, g.name ASC`,
      );
    return rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      sectionName: row.section_name,
    }));
  }

  /** Marca como vencidos los permisos pendientes de días anteriores. */
  async expireStalePermits(todayDate: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE scheduled_departure_permits SET status = 'EXPIRED'
       WHERE status = 'PENDING' AND permit_date < ?`,
      [todayDate],
    );
  }

  async findPermits(
    filter: { date?: string; status?: ScheduledPermitStatus; studentId?: number; id?: string },
    manager?: EntityManager,
  ): Promise<ScheduledPermitView[]> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filter.id) {
      clauses.push('p.id = ?');
      params.push(filter.id);
    }
    if (filter.date) {
      clauses.push('p.permit_date = ?');
      params.push(filter.date);
    }
    if (filter.status) {
      clauses.push('p.status = ?');
      params.push(filter.status);
    }
    if (filter.studentId) {
      clauses.push('p.student_id = ?');
      params.push(filter.studentId);
    }
    const rows: PermitRow[] = await this.runner(manager).query(
      `SELECT p.id AS permit_id, DATE_FORMAT(p.permit_date, '%Y-%m-%d') AS permit_date,
              TIME_FORMAT(p.departure_time, '%H:%i') AS permit_time, p.reason,
              p.status AS permit_status, p.completed_at, p.created_at,
              st.id_users AS id, st.name, st.first_lastname, st.second_lastname, st.national_id,
              g.id_groups AS group_id, g.name AS group_name, s.name AS section_name,
              au.id_users AS authorized_by_id, au.name AS auth_name,
              au.first_lastname AS auth_first_lastname, au.second_lastname AS auth_second_lastname
       FROM scheduled_departure_permits p
       INNER JOIN users st ON st.id_users = p.student_id
       INNER JOIN users au ON au.id_users = p.authorized_by_id
       ${CURRENT_GROUP_JOIN}
       ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
       ORDER BY p.permit_date ASC, p.departure_time ASC, p.created_at ASC, p.id ASC
       LIMIT 500`,
      params,
    );
    return rows.map((row) => ({
      id: row.permit_id,
      student: toStudent(row),
      authorizedBy: {
        id: Number(row.authorized_by_id),
        fullName: fullName(row.auth_name, row.auth_first_lastname, row.auth_second_lastname),
      },
      permitDate: row.permit_date,
      departureTime: row.permit_time,
      reason: row.reason,
      status: row.permit_status,
      completedAt: row.completed_at,
      createdAt: row.created_at,
    }));
  }
}
