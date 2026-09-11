import { TeachingAssignment } from '../entities/teaching-assignment.entity';

type AssignmentOfferingShape = Pick<
  TeachingAssignment,
  'offeringKind' | 'subjectId' | 'specialtyId'
>;

/** Guide-only row: no academic offering (Phase 0). Not impartable in Phase 1. */
export function isGuideOnlyAssignment(row: AssignmentOfferingShape): boolean {
  return (
    row.offeringKind == null &&
    row.subjectId == null &&
    row.specialtyId == null
  );
}

/**
 * Assignment that can back an AttendanceSession (Phase 1+).
 * Guide-only rows must never start a class session.
 */
export function isImpartableTeachingAssignment(
  row: AssignmentOfferingShape,
): boolean {
  return row.offeringKind != null;
}
