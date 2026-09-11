import { AcademicOfferingKind } from '../../../../common/enums/academic-offering-kind.enum';
import { AcademicOfferingEligibilityPolicy } from '../policies/academic-offering-eligibility.policy';

describe('AcademicOfferingEligibilityPolicy', () => {
  const policy = new AcademicOfferingEligibilityPolicy();

  const cases: Array<{
    grade: number;
    kind: AcademicOfferingKind;
    ok: boolean;
  }> = [
    { grade: 7, kind: AcademicOfferingKind.SUBJECT, ok: true },
    { grade: 7, kind: AcademicOfferingKind.EXPLORATORY_WORKSHOP, ok: true },
    { grade: 7, kind: AcademicOfferingKind.TECHNICAL_SPECIALTY, ok: false },
    { grade: 9, kind: AcademicOfferingKind.EXPLORATORY_WORKSHOP, ok: true },
    { grade: 9, kind: AcademicOfferingKind.TECHNICAL_SPECIALTY, ok: false },
    { grade: 10, kind: AcademicOfferingKind.SUBJECT, ok: true },
    { grade: 10, kind: AcademicOfferingKind.TECHNICAL_SPECIALTY, ok: true },
    { grade: 10, kind: AcademicOfferingKind.EXPLORATORY_WORKSHOP, ok: false },
    { grade: 12, kind: AcademicOfferingKind.SUBJECT, ok: true },
    { grade: 12, kind: AcademicOfferingKind.TECHNICAL_SPECIALTY, ok: true },
    { grade: 12, kind: AcademicOfferingKind.EXPLORATORY_WORKSHOP, ok: false },
  ];

  it.each(cases)(
    'grade $grade + $kind → ok=$ok',
    ({ grade, kind, ok }) => {
      expect(policy.isKindAllowedForGrade(kind, grade)).toBe(ok);
      if (ok) {
        expect(() => policy.assertKindAllowedForGrade(kind, grade)).not.toThrow();
      } else {
        expect(() => policy.assertKindAllowedForGrade(kind, grade)).toThrow();
      }
    },
  );

  it('grade 6 → empty / reject', () => {
    expect(policy.allowedKindsForGrade(6)).toEqual([]);
    expect(() =>
      policy.assertKindAllowedForGrade(AcademicOfferingKind.SUBJECT, 6),
    ).toThrow();
  });

  it('grade 13 → empty / reject', () => {
    expect(policy.allowedKindsForGrade(13)).toEqual([]);
    expect(() =>
      policy.assertKindAllowedForGrade(AcademicOfferingKind.SUBJECT, 13),
    ).toThrow();
  });
});
