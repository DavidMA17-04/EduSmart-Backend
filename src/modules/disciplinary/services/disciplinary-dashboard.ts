import { getSeverityRule, InfractionSeverity } from '../constants/infraction-severity.constant';
import { DisciplinaryCaseStatus } from '../constants/disciplinary.enums';
import { stepDeadline } from './case-read';
import { DisciplinaryAlert } from './disciplinary-alert-rules';
import { statusLabel } from './disciplinary-workflow';

const STATUS_ORDER = Object.values(DisciplinaryCaseStatus);
const SEVERITY_ORDER = Object.values(InfractionSeverity);
const TOP_STUDENTS = 5;

export interface DashboardCaseFact {
  id: number;
  status: DisciplinaryCaseStatus;
  severity: InfractionSeverity;
  studentUserId: number;
  studentFullName: string;
  groupId: number;
  sectionLabel: string;
  month: string;
  stepStartedOn: string;
  stepBusinessDays: number;
}

export interface DisciplinaryDashboard {
  total: number;
  byStatus: Array<{ status: string; label: string; count: number }>;
  bySeverity: Array<{ severity: string; label: string; count: number }>;
  bySection: Array<{ groupId: number; sectionLabel: string; count: number }>;
  byMonth: Array<{ month: string; count: number }>;
  deadlines: { dueSoon: number; overdue: number };
  alerts: DisciplinaryAlert[];
  topStudents: Array<{ studentUserId: number; fullName: string; count: number }>;
}

export function emptyDashboard(): DisciplinaryDashboard {
  return {
    total: 0,
    byStatus: [],
    bySeverity: [],
    bySection: [],
    byMonth: [],
    deadlines: { dueSoon: 0, overdue: 0 },
    alerts: [],
    topStudents: [],
  };
}

export function buildDashboard(
  cases: readonly DashboardCaseFact[],
  alerts: readonly DisciplinaryAlert[],
  today: string,
  holidays: ReadonlySet<string>,
  includeInstitutionalAlerts: boolean,
): DisciplinaryDashboard {
  const byStatus = new Map<string, number>();
  const bySeverity = new Map<string, number>();
  const bySection = new Map<number, { sectionLabel: string; count: number }>();
  const byMonth = new Map<string, number>();
  const byStudent = new Map<number, { fullName: string; count: number }>();
  let dueSoon = 0;
  let overdue = 0;

  for (const row of cases) {
    byStatus.set(row.status, (byStatus.get(row.status) ?? 0) + 1);
    bySeverity.set(row.severity, (bySeverity.get(row.severity) ?? 0) + 1);
    const section = bySection.get(row.groupId) ?? { sectionLabel: row.sectionLabel, count: 0 };
    section.count += 1;
    bySection.set(row.groupId, section);
    byMonth.set(row.month, (byMonth.get(row.month) ?? 0) + 1);
    const student = byStudent.get(row.studentUserId) ?? { fullName: row.studentFullName, count: 0 };
    student.count += 1;
    byStudent.set(row.studentUserId, student);
    const deadline = stepDeadline(row.stepStartedOn, row.stepBusinessDays, today, holidays);
    if (deadline.deadline === 'DUE_SOON') dueSoon += 1;
    if (deadline.deadline === 'OVERDUE') overdue += 1;
  }

  return {
    total: cases.length,
    byStatus: STATUS_ORDER.filter((status) => byStatus.has(status)).map((status) => ({
      status,
      label: statusLabel(status),
      count: byStatus.get(status) ?? 0,
    })),
    bySeverity: SEVERITY_ORDER.filter((severity) => bySeverity.has(severity)).map((severity) => ({
      severity,
      label: getSeverityRule(severity).label,
      count: bySeverity.get(severity) ?? 0,
    })),
    bySection: [...bySection.entries()]
      .map(([groupId, section]) => ({ groupId, sectionLabel: section.sectionLabel, count: section.count }))
      .sort((left, right) => right.count - left.count || left.sectionLabel.localeCompare(right.sectionLabel)),
    byMonth: [...byMonth.entries()]
      .map(([month, count]) => ({ month, count }))
      .sort((left, right) => left.month.localeCompare(right.month)),
    deadlines: { dueSoon, overdue },
    alerts: alerts
      .filter((alert) => matchesDashboard(alert, cases, includeInstitutionalAlerts))
      .map((alert) => ({
        ...alert,
        fullName:
          alert.studentUserId != null ? byStudent.get(alert.studentUserId)?.fullName : undefined,
      })),
    topStudents: [...byStudent.entries()]
      .map(([studentUserId, student]) => ({ studentUserId, fullName: student.fullName, count: student.count }))
      .sort((left, right) => right.count - left.count || left.fullName.localeCompare(right.fullName))
      .slice(0, TOP_STUDENTS),
  };
}

function matchesDashboard(
  alert: DisciplinaryAlert,
  cases: readonly DashboardCaseFact[],
  includeInstitutionalAlerts: boolean,
): boolean {
  const tied =
    alert.caseId != null || alert.groupId != null || alert.studentUserId != null;
  if (!tied) return includeInstitutionalAlerts;
  return cases.some(
    (row) =>
      row.id === alert.caseId ||
      row.groupId === alert.groupId ||
      row.studentUserId === alert.studentUserId,
  );
}
