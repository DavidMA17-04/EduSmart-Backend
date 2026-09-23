import { AbsenteeismRiskLevel } from '../../../common/enums/absenteeism-risk-level.enum';

export type AbsenteeismRuleCode =
  | 'UNJUSTIFIED_ABSENCES_MONTH'
  | 'ATTENDANCE_PERCENT_MIN'
  | 'CONSECUTIVE_ABSENCES'
  | 'ABSENCES_IN_PERIOD'
  | 'MEDIUM_UNJUSTIFIED_ABSENCES_MONTH';

export type AbsenteeismRuleThresholds = {
  unjustifiedAbsencesMonthHigh: number;
  unjustifiedAbsencesMonthMedium: number;
  attendancePercentMin: number;
  consecutiveAbsencesHigh: number;
  absencesPeriodHigh: number;
};

export const DEFAULT_ABSENTEEISM_THRESHOLDS: AbsenteeismRuleThresholds = {
  unjustifiedAbsencesMonthHigh: 5,
  unjustifiedAbsencesMonthMedium: 3,
  attendancePercentMin: 75,
  consecutiveAbsencesHigh: 3,
  absencesPeriodHigh: 10,
};

export type StudentAttendanceMark = {
  sessionDate: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'JUSTIFIED';
};

export type StudentAbsenteeismMetrics = {
  studentUserId: number;
  totalMarks: number;
  present: number;
  late: number;
  absent: number;
  justified: number;
  unjustifiedAbsencesMonth: number;
  absencesPeriod: number;
  consecutiveAbsences: number;
  attendancePercent: number;
  lastAbsenceDate: string | null;
  triggeredRules: AbsenteeismRuleCode[];
  riskLevel: AbsenteeismRiskLevel;
};

function toDateKey(value: string): string {
  return String(value).slice(0, 10);
}

export function countConsecutiveAbsences(
  marks: StudentAttendanceMark[],
): number {
  const absentDates = [
    ...new Set(
      marks
        .filter((m) => m.status === 'ABSENT')
        .map((m) => toDateKey(m.sessionDate)),
    ),
  ].sort();

  if (absentDates.length === 0) return 0;

  let best = 1;
  let current = 1;
  for (let i = 1; i < absentDates.length; i += 1) {
    const prev = new Date(`${absentDates[i - 1]}T00:00:00`);
    const curr = new Date(`${absentDates[i]}T00:00:00`);
    const diffDays = Math.round(
      (curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000),
    );
    if (diffDays === 1) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 1;
    }
  }
  return best;
}

export function evaluateStudentAbsenteeism(
  studentUserId: number,
  marks: StudentAttendanceMark[],
  monthStart: string,
  monthEnd: string,
  thresholds: AbsenteeismRuleThresholds = DEFAULT_ABSENTEEISM_THRESHOLDS,
): StudentAbsenteeismMetrics {
  const present = marks.filter((m) => m.status === 'PRESENT').length;
  const late = marks.filter((m) => m.status === 'LATE').length;
  const absent = marks.filter((m) => m.status === 'ABSENT').length;
  const justified = marks.filter((m) => m.status === 'JUSTIFIED').length;
  const totalMarks = marks.length;

  const unjustifiedAbsencesMonth = marks.filter((m) => {
    const d = toDateKey(m.sessionDate);
    return m.status === 'ABSENT' && d >= monthStart && d <= monthEnd;
  }).length;

  const absencesPeriod = absent;
  const consecutiveAbsences = countConsecutiveAbsences(marks);
  const attended = present + late + justified;
  const attendancePercent =
    totalMarks === 0 ? 100 : Math.round((attended / totalMarks) * 1000) / 10;

  const lastAbsenceDate =
    marks
      .filter((m) => m.status === 'ABSENT')
      .map((m) => toDateKey(m.sessionDate))
      .sort()
      .at(-1) ?? null;

  const triggeredRules: AbsenteeismRuleCode[] = [];

  if (unjustifiedAbsencesMonth >= thresholds.unjustifiedAbsencesMonthHigh) {
    triggeredRules.push('UNJUSTIFIED_ABSENCES_MONTH');
  } else if (
    unjustifiedAbsencesMonth >= thresholds.unjustifiedAbsencesMonthMedium
  ) {
    triggeredRules.push('MEDIUM_UNJUSTIFIED_ABSENCES_MONTH');
  }

  if (
    totalMarks > 0 &&
    attendancePercent < thresholds.attendancePercentMin
  ) {
    triggeredRules.push('ATTENDANCE_PERCENT_MIN');
  }

  if (consecutiveAbsences >= thresholds.consecutiveAbsencesHigh) {
    triggeredRules.push('CONSECUTIVE_ABSENCES');
  }

  if (absencesPeriod >= thresholds.absencesPeriodHigh) {
    triggeredRules.push('ABSENCES_IN_PERIOD');
  }

  let riskLevel = AbsenteeismRiskLevel.LOW;
  if (
    triggeredRules.includes('UNJUSTIFIED_ABSENCES_MONTH') ||
    triggeredRules.includes('ATTENDANCE_PERCENT_MIN') ||
    triggeredRules.includes('CONSECUTIVE_ABSENCES') ||
    triggeredRules.includes('ABSENCES_IN_PERIOD')
  ) {
    riskLevel = AbsenteeismRiskLevel.HIGH;
  } else if (triggeredRules.includes('MEDIUM_UNJUSTIFIED_ABSENCES_MONTH')) {
    riskLevel = AbsenteeismRiskLevel.MEDIUM;
  }

  return {
    studentUserId,
    totalMarks,
    present,
    late,
    absent,
    justified,
    unjustifiedAbsencesMonth,
    absencesPeriod,
    consecutiveAbsences,
    attendancePercent,
    lastAbsenceDate,
    triggeredRules,
    riskLevel,
  };
}

export function monthWindowFor(date = new Date()): {
  start: string;
  end: string;
} {
  const y = date.getFullYear();
  const m = date.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}
