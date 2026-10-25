import { DisciplinaryTrack } from './disciplinary.enums';

export enum InfractionSeverity {
  VERY_MINOR = 'VERY_MINOR',
  MINOR = 'MINOR',
  SERIOUS = 'SERIOUS',
  VERY_SERIOUS = 'VERY_SERIOUS',
  EXTREMELY_SERIOUS = 'EXTREMELY_SERIOUS',
}

export { DisciplinaryTrack };

export interface InfractionSeverityRule {
  severity: InfractionSeverity;
  label: string;
  deduction: number;
  track: DisciplinaryTrack;
}

/** REAC 2026 Art. 143 (rebajo fijo) y Art. 150 (debido proceso desde grave). */
export const INFRACTION_SEVERITY_RULES: readonly InfractionSeverityRule[] = [
  { severity: InfractionSeverity.VERY_MINOR, label: 'Muy leve', deduction: 5, track: DisciplinaryTrack.DIRECT },
  { severity: InfractionSeverity.MINOR, label: 'Leve', deduction: 10, track: DisciplinaryTrack.DIRECT },
  { severity: InfractionSeverity.SERIOUS, label: 'Grave', deduction: 20, track: DisciplinaryTrack.DUE_PROCESS },
  {
    severity: InfractionSeverity.VERY_SERIOUS,
    label: 'Muy grave',
    deduction: 35,
    track: DisciplinaryTrack.DUE_PROCESS,
  },
  {
    severity: InfractionSeverity.EXTREMELY_SERIOUS,
    label: 'Gravísima',
    deduction: 50,
    track: DisciplinaryTrack.DUE_PROCESS,
  },
];

export function getSeverityRule(severity: InfractionSeverity): InfractionSeverityRule {
  const rule = INFRACTION_SEVERITY_RULES.find((r) => r.severity === severity);
  if (!rule) {
    throw new Error(`Unknown infraction severity: ${severity}`);
  }
  return rule;
}
