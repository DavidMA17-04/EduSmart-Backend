import { DepartureStatus, DepartureType } from '../entities/student-departure.entity';
import { ScheduledPermitStatus } from '../entities/scheduled-departure-permit.entity';

export interface StudentSummary {
  id: number;
  fullName: string;
  nationalId: string;
  groupId: number | null;
  groupName: string | null;
  sectionName: string | null;
}

export interface RegisteredGuardian {
  id: number;
  fullName: string;
  nationalIdMasked: string;
  relationship: string | null;
  active: boolean;
}

export interface ScheduledPermitView {
  id: string;
  student: StudentSummary;
  authorizedBy: { id: number; fullName: string };
  permitDate: string;
  departureTime: string;
  reason: string;
  status: ScheduledPermitStatus;
  completedAt: Date | null;
  createdAt: Date;
}

export interface GuardianValidationResult {
  authorized: boolean;
  message: string;
  student: StudentSummary;
  guardian: (RegisteredGuardian & { nationalId: string }) | null;
  relationship: string | null;
  registeredGuardians: RegisteredGuardian[];
  /** Permiso programado pendiente para hoy, si existe. */
  pendingPermit: ScheduledPermitView | null;
  /** Última salida autorizada de hoy, para advertir duplicados. */
  lastAuthorizedToday: { id: string; departureTime: Date } | null;
  /** Id del intento denegado registrado cuando no coincide. */
  rejectionId: string | null;
}

export interface DepartureHistoryItem {
  id: string;
  departureTime: Date;
  status: DepartureStatus;
  departureType: DepartureType;
  justificationReason: string | null;
  relationship: string | null;
  guardianIdentifierMasked: string | null;
  /** true si quien se presentó es un encargado vinculado (autorizadas y rechazos manuales). */
  guardianLinked: boolean;
  student: StudentSummary;
  guardian: { id: number; fullName: string } | null;
  securityGuard: { id: number; fullName: string };
  scheduledPermitId: string | null;
}

export interface PaginatedDepartures {
  items: DepartureHistoryItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TodayKpis {
  date: string;
  totalDepartures: number;
  earlyDepartures: number;
  emergencyDepartures: number;
  deniedAttempts: number;
  pendingPermits: number;
  generatedAt: Date;
}
