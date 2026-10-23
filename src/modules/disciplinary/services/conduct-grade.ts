import { DisciplinaryCaseStatus } from '../constants/disciplinary.enums';
import { getSeverityRule, InfractionSeverity } from '../constants/infraction-severity.constant';

export const CONDUCT_BASE_GRADE = 100;

export type DeductionState = 'APPLIED' | 'PROPOSED' | 'NONE';

export interface ConductCaseInput {
  id: number;
  caseNumber: string;
  status: DisciplinaryCaseStatus;
  severity: InfractionSeverity;
  track: string;
  academicPeriodId: number;
  periodName: string;
  occurredAt: string | null;
  infractionName: string;
}

export interface ConductHistoryCase extends ConductCaseInput {
  severityLabel: string;
  deduction: number;
  deductionState: DeductionState;
  deductionLabel: string;
}

export interface ConductPeriodHistory {
  academicPeriodId: number;
  periodName: string;
  appliedDeduction: number;
  conductGrade: number;
  cases: ConductHistoryCase[];
}

export function deductionOf(
  status: DisciplinaryCaseStatus,
  severity: InfractionSeverity,
): { state: DeductionState; points: number; label: string } {
  const points = getSeverityRule(severity).deduction;
  if (status === DisciplinaryCaseStatus.FIRM) {
    return { state: 'APPLIED', points, label: `Rebajo aplicado: ${points} puntos` };
  }
  if (status === DisciplinaryCaseStatus.DISMISSED || status === DisciplinaryCaseStatus.ANNULLED) {
    return { state: 'NONE', points: 0, label: 'Sin rebajo' };
  }
  return { state: 'PROPOSED', points, label: `Rebajo propuesto: ${points} puntos` };
}

export function conductGradeFromPoints(appliedPoints: readonly number[]): number {
  const sum = appliedPoints.reduce((total, points) => total + points, 0);
  return Math.max(0, CONDUCT_BASE_GRADE - sum);
}

export function buildConductHistory(
  cases: readonly ConductCaseInput[],
  filters: { status?: DisciplinaryCaseStatus; severity?: InfractionSeverity } = {},
): ConductPeriodHistory[] {
  const periods = new Map<
    number,
    { academicPeriodId: number; periodName: string; applied: number[]; visible: ConductHistoryCase[] }
  >();

  for (const item of cases) {
    const deduction = deductionOf(item.status, item.severity);
    const bucket = periods.get(item.academicPeriodId) ?? {
      academicPeriodId: item.academicPeriodId,
      periodName: item.periodName,
      applied: [],
      visible: [],
    };
    if (deduction.state === 'APPLIED') bucket.applied.push(deduction.points);
    const matchesStatus = !filters.status || item.status === filters.status;
    const matchesSeverity = !filters.severity || item.severity === filters.severity;
    if (matchesStatus && matchesSeverity) {
      bucket.visible.push({
        ...item,
        severityLabel: getSeverityRule(item.severity).label,
        deduction: deduction.points,
        deductionState: deduction.state,
        deductionLabel: deduction.label,
      });
    }
    periods.set(item.academicPeriodId, bucket);
  }

  return [...periods.values()]
    .filter((period) => period.visible.length > 0)
    .map((period) => ({
      academicPeriodId: period.academicPeriodId,
      periodName: period.periodName,
      appliedDeduction: period.applied.reduce((total, points) => total + points, 0),
      conductGrade: conductGradeFromPoints(period.applied),
      cases: period.visible,
    }));
}
