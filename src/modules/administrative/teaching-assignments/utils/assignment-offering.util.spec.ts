import { AcademicOfferingKind } from '../../../../common/enums/academic-offering-kind.enum';
import {
  isGuideOnlyAssignment,
  isImpartableTeachingAssignment,
} from '../utils/assignment-offering.util';

describe('assignment-offering.util', () => {
  it('guide-only when all offering fields null', () => {
    const row = {
      offeringKind: null,
      subjectId: null,
      specialtyId: null,
    };
    expect(isGuideOnlyAssignment(row)).toBe(true);
    expect(isImpartableTeachingAssignment(row)).toBe(false);
  });

  it('impartable when offeringKind set', () => {
    const row = {
      offeringKind: AcademicOfferingKind.SUBJECT,
      subjectId: 3,
      specialtyId: null,
    };
    expect(isGuideOnlyAssignment(row)).toBe(false);
    expect(isImpartableTeachingAssignment(row)).toBe(true);
  });
});
