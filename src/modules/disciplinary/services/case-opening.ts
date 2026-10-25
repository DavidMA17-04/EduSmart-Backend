import { BadRequestException } from '@nestjs/common';
import { DisciplinaryCaseStatus, DisciplinaryTrack } from '../constants/disciplinary.enums';
import { businessDaysBetween } from '../utils/business-days';

export const REPORT_BUSINESS_DAYS = 5;
export const REVOCATION_BUSINESS_DAYS = 3;
export const DEFENSE_BUSINESS_DAYS = 3;

export function formatCaseNumber(year: number, value: number): string {
  return `AM-${year}-${String(value).padStart(4, '0')}`;
}

export interface CaseOpeningInput {
  track: DisciplinaryTrack;
  occurredOn: string;
  today: string;
  reporterUserId: number;
  guideUserId: number | null;
  lateReportReason?: string | null;
  nonWorkingDays?: ReadonlySet<string>;
}

export interface CaseOpeningPlan {
  status: DisciplinaryCaseStatus;
  responsibleUserId: number | null;
  missingGuideTeacher: boolean;
  isLateReport: boolean;
  lateReportReason: string | null;
  stepStartedOn: string;
  stepBusinessDays: number;
}

export function planCaseOpening(input: CaseOpeningInput): CaseOpeningPlan {
  const isDueProcess = input.track === DisciplinaryTrack.DUE_PROCESS;
  const elapsed = businessDaysBetween(input.occurredOn, input.today, input.nonWorkingDays);
  const isLateReport = isDueProcess && elapsed > REPORT_BUSINESS_DAYS;
  const reason = input.lateReportReason?.trim() || null;
  if (isLateReport && !reason) {
    throw new BadRequestException({
      code: 'LATE_REPORT_REASON_REQUIRED',
      message: 'El reporte extemporáneo requiere una justificación',
      field: 'lateReportReason',
    });
  }

  return {
    status: isDueProcess ? DisciplinaryCaseStatus.REPORTED : DisciplinaryCaseStatus.NOTIFIED,
    responsibleUserId: isDueProcess ? input.guideUserId : input.reporterUserId,
    missingGuideTeacher: isDueProcess && input.guideUserId == null,
    isLateReport,
    lateReportReason: isLateReport ? reason : null,
    stepStartedOn: input.today,
    stepBusinessDays: isDueProcess ? 0 : REVOCATION_BUSINESS_DAYS,
  };
}
