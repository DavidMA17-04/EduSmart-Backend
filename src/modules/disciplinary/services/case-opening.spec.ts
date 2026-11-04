import { BadRequestException } from '@nestjs/common';
import { DisciplinaryCaseStatus, DisciplinaryTrack } from '../constants/disciplinary.enums';
import { formatCaseNumber, planCaseOpening } from './case-opening';

describe('apertura de expediente', () => {
  it('formatea el número AM-AAAA-NNNN', () => {
    expect(formatCaseNumber(2026, 1)).toBe('AM-2026-0001');
    expect(formatCaseNumber(2026, 42)).toBe('AM-2026-0042');
  });

  it('una falta grave queda Reportada con el docente guía como responsable', () => {
    const plan = planCaseOpening({
      track: DisciplinaryTrack.DUE_PROCESS,
      occurredOn: '2026-10-14',
      today: '2026-10-19',
      reporterUserId: 4,
      guideUserId: 9,
    });
    expect(plan).toMatchObject({
      status: DisciplinaryCaseStatus.REPORTED,
      responsibleUserId: 9,
      missingGuideTeacher: false,
      isLateReport: false,
      stepBusinessDays: 0,
    });
    expect(
      planCaseOpening({
        track: DisciplinaryTrack.DUE_PROCESS,
        occurredOn: '2026-10-14',
        today: '2026-10-21',
        reporterUserId: 4,
        guideUserId: 9,
      }).isLateReport,
    ).toBe(false);
  });

  it('sin docente guía abre el expediente y lo marca', () => {
    const plan = planCaseOpening({
      track: DisciplinaryTrack.DUE_PROCESS,
      occurredOn: '2026-10-14',
      today: '2026-10-19',
      reporterUserId: 4,
      guideUserId: null,
    });
    expect(plan.missingGuideTeacher).toBe(true);
    expect(plan.responsibleUserId).toBeNull();
    expect(plan.status).toBe(DisciplinaryCaseStatus.REPORTED);
  });

  it('una falta leve queda Notificada con el plazo de revocatoria', () => {
    const plan = planCaseOpening({
      track: DisciplinaryTrack.DIRECT,
      occurredOn: '2026-10-01',
      today: '2026-10-19',
      reporterUserId: 4,
      guideUserId: 9,
    });
    expect(plan).toMatchObject({
      status: DisciplinaryCaseStatus.NOTIFIED,
      responsibleUserId: 4,
      missingGuideTeacher: false,
      isLateReport: false,
      stepStartedOn: '2026-10-19',
      stepBusinessDays: 3,
    });
  });

  it('un reporte grave después de 5 días hábiles exige justificación', () => {
    const input = {
      track: DisciplinaryTrack.DUE_PROCESS,
      occurredOn: '2026-10-08',
      today: '2026-10-19',
      reporterUserId: 4,
      guideUserId: 9,
    };
    expect(() => planCaseOpening(input)).toThrow(BadRequestException);
    const plan = planCaseOpening({ ...input, lateReportReason: 'El docente estaba incapacitado' });
    expect(plan.isLateReport).toBe(true);
    expect(plan.lateReportReason).toBe('El docente estaba incapacitado');
  });
});
