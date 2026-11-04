import { AbsenteeismRiskLevel } from '../../../common/enums/absenteeism-risk-level.enum';
import {
  countConsecutiveAbsences,
  evaluateStudentAbsenteeism,
} from './absenteeism-rules.util';

describe('absenteeism-rules.util', () => {
  it('counts consecutive absence days', () => {
    expect(
      countConsecutiveAbsences([
        { sessionDate: '2026-05-20', status: 'ABSENT' },
        { sessionDate: '2026-05-21', status: 'ABSENT' },
        { sessionDate: '2026-05-22', status: 'ABSENT' },
        { sessionDate: '2026-05-24', status: 'ABSENT' },
      ]),
    ).toBe(3);
  });

  it('flags HIGH for 5+ unjustified absences in month', () => {
    const marks = Array.from({ length: 5 }, (_, i) => ({
      sessionDate: `2026-05-${String(i + 10).padStart(2, '0')}`,
      status: 'ABSENT' as const,
    }));
    const result = evaluateStudentAbsenteeism(
      1,
      marks,
      '2026-05-01',
      '2026-05-31',
    );
    expect(result.riskLevel).toBe(AbsenteeismRiskLevel.HIGH);
    expect(result.triggeredRules).toContain('UNJUSTIFIED_ABSENCES_MONTH');
  });

  it('flags HIGH when attendance percent is below 75', () => {
    const marks = [
      ...Array.from({ length: 7 }, (_, i) => ({
        sessionDate: `2026-05-${String(i + 1).padStart(2, '0')}`,
        status: 'PRESENT' as const,
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        sessionDate: `2026-05-${String(i + 20).padStart(2, '0')}`,
        status: 'ABSENT' as const,
      })),
    ];
    // 7/10 = 70%
    const result = evaluateStudentAbsenteeism(
      2,
      marks,
      '2026-05-01',
      '2026-05-31',
    );
    expect(result.attendancePercent).toBe(70);
    expect(result.riskLevel).toBe(AbsenteeismRiskLevel.HIGH);
    expect(result.triggeredRules).toContain('ATTENDANCE_PERCENT_MIN');
  });

  it('flags MEDIUM for 3–4 unjustified absences without high rules', () => {
    const marks = [
      ...Array.from({ length: 20 }, (_, i) => ({
        sessionDate: `2026-04-${String(i + 1).padStart(2, '0')}`,
        status: 'PRESENT' as const,
      })),
      { sessionDate: '2026-05-10', status: 'ABSENT' as const },
      { sessionDate: '2026-05-12', status: 'ABSENT' as const },
      { sessionDate: '2026-05-14', status: 'ABSENT' as const },
    ];
    const result = evaluateStudentAbsenteeism(
      3,
      marks,
      '2026-05-01',
      '2026-05-31',
    );
    expect(result.unjustifiedAbsencesMonth).toBe(3);
    expect(result.riskLevel).toBe(AbsenteeismRiskLevel.MEDIUM);
    expect(result.triggeredRules).toContain('MEDIUM_UNJUSTIFIED_ABSENCES_MONTH');
  });
});
