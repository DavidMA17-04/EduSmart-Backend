import { BadRequestException } from '@nestjs/common';
import { DisciplinaryCaseStatus, DisciplinaryTrack } from '../constants/disciplinary.enums';

const STATUS_LABELS: Record<DisciplinaryCaseStatus, string> = {
  [DisciplinaryCaseStatus.REPORTED]: 'Reportada',
  [DisciplinaryCaseStatus.INVESTIGATING]: 'En investigación',
  [DisciplinaryCaseStatus.COMMUNICATED]: 'Comunicada',
  [DisciplinaryCaseStatus.PENDING_RESOLUTION]: 'Pendiente de resolución',
  [DisciplinaryCaseStatus.RESOLVED]: 'Resuelta',
  [DisciplinaryCaseStatus.IN_APPEAL]: 'En recurso',
  [DisciplinaryCaseStatus.FIRM]: 'Firme',
  [DisciplinaryCaseStatus.DISMISSED]: 'Desestimada',
  [DisciplinaryCaseStatus.ANNULLED]: 'Anulada',
  [DisciplinaryCaseStatus.NOTIFIED]: 'Notificada',
};

/** Estados desde los que ya no hay salida. */
export const FINAL_CASE_STATUSES = new Set<DisciplinaryCaseStatus>([
  DisciplinaryCaseStatus.FIRM,
  DisciplinaryCaseStatus.DISMISSED,
  DisciplinaryCaseStatus.ANNULLED,
]);

const DUE_PROCESS_TRANSITIONS: Record<DisciplinaryCaseStatus, readonly DisciplinaryCaseStatus[]> = {
  [DisciplinaryCaseStatus.REPORTED]: [
    DisciplinaryCaseStatus.INVESTIGATING,
    DisciplinaryCaseStatus.ANNULLED,
  ],
  [DisciplinaryCaseStatus.INVESTIGATING]: [
    DisciplinaryCaseStatus.COMMUNICATED,
    DisciplinaryCaseStatus.DISMISSED,
    DisciplinaryCaseStatus.ANNULLED,
  ],
  [DisciplinaryCaseStatus.COMMUNICATED]: [
    DisciplinaryCaseStatus.PENDING_RESOLUTION,
    DisciplinaryCaseStatus.ANNULLED,
  ],
  [DisciplinaryCaseStatus.PENDING_RESOLUTION]: [
    DisciplinaryCaseStatus.RESOLVED,
    DisciplinaryCaseStatus.ANNULLED,
  ],
  [DisciplinaryCaseStatus.RESOLVED]: [
    DisciplinaryCaseStatus.IN_APPEAL,
    DisciplinaryCaseStatus.FIRM,
    DisciplinaryCaseStatus.DISMISSED,
    DisciplinaryCaseStatus.ANNULLED,
  ],
  [DisciplinaryCaseStatus.IN_APPEAL]: [
    DisciplinaryCaseStatus.FIRM,
    DisciplinaryCaseStatus.DISMISSED,
    DisciplinaryCaseStatus.ANNULLED,
  ],
  [DisciplinaryCaseStatus.NOTIFIED]: [],
  [DisciplinaryCaseStatus.FIRM]: [DisciplinaryCaseStatus.ANNULLED],
  [DisciplinaryCaseStatus.DISMISSED]: [],
  [DisciplinaryCaseStatus.ANNULLED]: [],
};

/** Notificada → En recurso → Firme o Desestimada, y anulación de un estado no final. */
const DIRECT_TRANSITIONS: Record<DisciplinaryCaseStatus, readonly DisciplinaryCaseStatus[]> = {
  [DisciplinaryCaseStatus.NOTIFIED]: [
    DisciplinaryCaseStatus.IN_APPEAL,
    DisciplinaryCaseStatus.FIRM,
    DisciplinaryCaseStatus.ANNULLED,
  ],
  [DisciplinaryCaseStatus.IN_APPEAL]: [
    DisciplinaryCaseStatus.FIRM,
    DisciplinaryCaseStatus.DISMISSED,
    DisciplinaryCaseStatus.ANNULLED,
  ],
  [DisciplinaryCaseStatus.REPORTED]: [],
  [DisciplinaryCaseStatus.INVESTIGATING]: [],
  [DisciplinaryCaseStatus.COMMUNICATED]: [],
  [DisciplinaryCaseStatus.PENDING_RESOLUTION]: [],
  [DisciplinaryCaseStatus.RESOLVED]: [],
  [DisciplinaryCaseStatus.FIRM]: [DisciplinaryCaseStatus.ANNULLED],
  [DisciplinaryCaseStatus.DISMISSED]: [],
  [DisciplinaryCaseStatus.ANNULLED]: [],
};

export function statusLabel(status: DisciplinaryCaseStatus): string {
  return STATUS_LABELS[status];
}

export function canTransition(
  track: DisciplinaryTrack,
  from: DisciplinaryCaseStatus,
  to: DisciplinaryCaseStatus,
): boolean {
  const table = track === DisciplinaryTrack.DIRECT ? DIRECT_TRANSITIONS : DUE_PROCESS_TRANSITIONS;
  return table[from].includes(to);
}

export function assertTransition(
  track: DisciplinaryTrack,
  from: DisciplinaryCaseStatus,
  to: DisciplinaryCaseStatus,
): void {
  if (canTransition(track, from, to)) return;
  throw new BadRequestException({
    code: 'DISCIPLINARY_INVALID_TRANSITION',
    message: `El expediente no puede pasar de ${statusLabel(from)} a ${statusLabel(to)}`,
  });
}
