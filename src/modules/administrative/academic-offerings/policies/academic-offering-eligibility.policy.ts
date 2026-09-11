import { BadRequestException } from '@nestjs/common';
import { AcademicOfferingKind } from '../../../../common/enums/academic-offering-kind.enum';

/**
 * Pure grade → offering-kind eligibility (no DB).
 * 7–9: SUBJECT + EXPLORATORY_WORKSHOP
 * 10–12: SUBJECT + TECHNICAL_SPECIALTY
 * other grades: none
 */
export class AcademicOfferingEligibilityPolicy {
  allowedKindsForGrade(grade: number): AcademicOfferingKind[] {
    if (!Number.isInteger(grade)) return [];
    if (grade >= 7 && grade <= 9) {
      return [
        AcademicOfferingKind.SUBJECT,
        AcademicOfferingKind.EXPLORATORY_WORKSHOP,
      ];
    }
    if (grade >= 10 && grade <= 12) {
      return [
        AcademicOfferingKind.SUBJECT,
        AcademicOfferingKind.TECHNICAL_SPECIALTY,
      ];
    }
    return [];
  }

  isKindAllowedForGrade(kind: AcademicOfferingKind, grade: number): boolean {
    return this.allowedKindsForGrade(grade).includes(kind);
  }

  assertKindAllowedForGrade(kind: AcademicOfferingKind, grade: number): void {
    if (this.isKindAllowedForGrade(kind, grade)) return;
    throw new BadRequestException({
      code: 'OFFERING_KIND_NOT_ELIGIBLE_FOR_GRADE',
      message: `Offering kind ${kind} is not allowed for grade level ${grade}`,
      grade,
      kind,
      allowedKinds: this.allowedKindsForGrade(grade),
    });
  }
}
