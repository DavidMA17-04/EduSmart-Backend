/**
 * Side-state on the attendance mark (does not replace PRESENT|ABSENT|LATE).
 * Tracks whether the ABSENT mark has an active / resolved justification.
 */
export enum AttendanceJustificationStatus {
  NONE = 'NONE',
  PENDING = 'PENDING',
  JUSTIFIED = 'JUSTIFIED',
  REJECTED = 'REJECTED',
}
