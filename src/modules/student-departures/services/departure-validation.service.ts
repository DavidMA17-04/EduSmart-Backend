import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuditLog } from '../../administrative/users/entities/audit-log.entity';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { RequestClientMeta } from '../../auth/utils/request-client-meta';
import {
  DepartureStatus,
  DepartureType,
  StudentDeparture,
} from '../entities/student-departure.entity';
import { ScheduledPermitStatus } from '../entities/scheduled-departure-permit.entity';
import {
  GuardianValidationResult,
  RegisteredGuardian,
  StudentSummary,
} from '../interfaces/departures.interface';
import { DeparturesRepository } from '../repositories/departures.repository';
import { costaRicaTodayBounds } from '../utils/costa-rica-time';
import { normalizeNationalId } from '../utils/identity';

export const GUARDIAN_MISMATCH_MESSAGE =
  'El encargado no coincide con los tutores legales registrados para este estudiante';
export const AUDIT_ACTION_GUARDIAN_MISMATCH = 'DEPARTURE_GUARDIAN_MISMATCH';
export const AUDIT_ACTION_MANUAL_REJECTION = 'DEPARTURE_MANUAL_REJECTION';

export interface GuardianCheck {
  student: StudentSummary;
  guardians: Array<RegisteredGuardian & { nationalId: string }>;
  match: (RegisteredGuardian & { nationalId: string }) | null;
  guardianNationalId: string;
}

/**
 * Regla central del módulo: un estudiante solo sale si quien lo retira es un
 * encargado ACTIVO vinculado en `guardian_student_links`.
 */
@Injectable()
export class DepartureValidationService {
  constructor(
    private readonly repository: DeparturesRepository,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /** Compara la cédula presentada contra los encargados vinculados. No escribe nada. */
  async checkGuardian(
    studentIdentifier: string,
    guardianIdentifier: string,
  ): Promise<GuardianCheck> {
    const student = await this.repository.findActiveStudent(studentIdentifier);
    if (!student) {
      throw new NotFoundException('No se encontró un estudiante activo con esa identificación.');
    }
    const guardians = await this.repository.findLinkedGuardians(student.id);
    const guardianNationalId = normalizeNationalId(guardianIdentifier);
    const match =
      guardians.find(
        (g) =>
          g.active &&
          guardianNationalId.length > 0 &&
          normalizeNationalId(g.nationalId) === guardianNationalId,
      ) ?? null;
    return { student, guardians, match, guardianNationalId };
  }

  /**
   * Registra un intento denegado y su alerta en `audit_logs` en una sola transacción.
   */
  async recordRejection(
    check: GuardianCheck,
    actor: AuthenticatedUser,
    meta: RequestClientMeta,
    options: {
      reason: string;
      departureType?: DepartureType;
      scheduledPermitId?: string | null;
      /** MANUAL: el guarda rechazó por decisión propia (el encargado puede estar vinculado). */
      kind?: 'MISMATCH' | 'MANUAL';
    },
  ): Promise<string> {
    const manual = options.kind === 'MANUAL';
    const linked = manual ? check.match : null;
    const guardianUserId = linked
      ? linked.id
      : check.guardianNationalId
        ? await this.repository.findUserIdByNationalId(check.guardianNationalId)
        : null;

    return this.dataSource.transaction(async (manager) => {
      const departure = manager.getRepository(StudentDeparture).create({
        studentId: check.student.id,
        guardianId: guardianUserId,
        guardianIdentifier: check.guardianNationalId || null,
        relationship: linked?.relationship ?? null,
        securityGuardId: actor.id,
        scheduledPermitId: options.scheduledPermitId ?? null,
        departureTime: new Date(),
        status: DepartureStatus.REJECTED,
        departureType: options.departureType ?? DepartureType.REGULAR,
        justificationReason: options.reason,
      });
      const saved = await manager.getRepository(StudentDeparture).save(departure);

      await manager.getRepository(AuditLog).save(
        manager.getRepository(AuditLog).create({
          actorId: actor.id,
          action: manual ? AUDIT_ACTION_MANUAL_REJECTION : AUDIT_ACTION_GUARDIAN_MISMATCH,
          entity: 'student_departures',
          entityId: saved.id,
          before: null,
          after: {
            studentId: check.student.id,
            studentNationalId: check.student.nationalId,
            presentedGuardianId: check.guardianNationalId,
            presentedGuardianUserId: guardianUserId,
            registeredGuardianIds: check.guardians.map((g) => g.id),
            reason: options.reason,
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
            occurredAt: new Date().toISOString(),
          },
        }),
      );
      return saved.id;
    });
  }

  /** POST validate-guardian: valida y, si no coincide, deja constancia del intento. */
  async validateGuardian(
    studentIdentifier: string,
    guardianIdentifier: string,
    actor: AuthenticatedUser,
    meta: RequestClientMeta,
  ): Promise<GuardianValidationResult> {
    const check = await this.checkGuardian(studentIdentifier, guardianIdentifier);
    const today = costaRicaTodayBounds();
    const [pendingPermits, lastAuthorizedToday] = await Promise.all([
      this.repository.findPermits({
        date: today.date,
        status: ScheduledPermitStatus.PENDING,
        studentId: check.student.id,
      }),
      this.repository.findLastAuthorizedBetween(check.student.id, today.start, today.end),
    ]);

    const registeredGuardians: RegisteredGuardian[] = check.guardians.map(
      ({ nationalId: _nationalId, ...rest }) => rest,
    );

    if (!check.match) {
      const rejectionId = await this.recordRejection(check, actor, meta, {
        reason: GUARDIAN_MISMATCH_MESSAGE,
      });
      return {
        authorized: false,
        message: GUARDIAN_MISMATCH_MESSAGE,
        student: check.student,
        guardian: null,
        relationship: null,
        registeredGuardians,
        pendingPermit: pendingPermits[0] ?? null,
        lastAuthorizedToday,
        rejectionId,
      };
    }

    return {
      authorized: true,
      message: 'El encargado coincide con los registros oficiales.',
      student: check.student,
      guardian: check.match,
      relationship: check.match.relationship,
      registeredGuardians,
      pendingPermit: pendingPermits[0] ?? null,
      lastAuthorizedToday,
      rejectionId: null,
    };
  }
}
