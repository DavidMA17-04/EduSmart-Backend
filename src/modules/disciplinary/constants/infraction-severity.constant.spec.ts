import {
  getSeverityRule,
  INFRACTION_SEVERITY_RULES,
  InfractionSeverity,
} from './infraction-severity.constant';

describe('INFRACTION_SEVERITY_RULES (REAC 2026 Art. 143 / 150)', () => {
  it('rebajo fijo 5/10/20/35/50 en orden de gravedad', () => {
    expect(INFRACTION_SEVERITY_RULES.map((r) => r.deduction)).toEqual([5, 10, 20, 35, 50]);
  });

  it('muy leve y leve van por amonestación directa; grave en adelante por debido proceso', () => {
    expect(getSeverityRule(InfractionSeverity.VERY_MINOR).track).toBe('DIRECT');
    expect(getSeverityRule(InfractionSeverity.MINOR).track).toBe('DIRECT');
    expect(getSeverityRule(InfractionSeverity.SERIOUS).track).toBe('DUE_PROCESS');
    expect(getSeverityRule(InfractionSeverity.VERY_SERIOUS).track).toBe('DUE_PROCESS');
    expect(getSeverityRule(InfractionSeverity.EXTREMELY_SERIOUS).track).toBe('DUE_PROCESS');
  });
});
