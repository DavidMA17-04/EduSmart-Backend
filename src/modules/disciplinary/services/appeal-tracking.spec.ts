import { AppealKind, AppealOutcome, CommunicationKind, DisciplinaryCaseStatus } from '../constants/disciplinary.enums';
import { InfractionSeverity } from '../constants/infraction-severity.constant';
import { appealDeduction, buildAppealTimeline } from './appeal-tracking';

describe('cronología del recurso', () => {
  it('arma las etapas reales en español y no inventa comités ni fechas', () => {
    const timeline = buildAppealTimeline({
      events: [
        {
          type: 'REVOCATION_FILED',
          createdAt: '2026-10-16T15:00:00.000Z',
          payload: { note: 'Recurso de revocatoria presentado' },
        },
        { type: 'REVOCATION_RESOLVED', createdAt: '2026-10-17T16:00:00.000Z', payload: { note: 'Revocatoria rechazada' } },
        { type: 'SUBSIDIARY_ELEVATED', createdAt: '2026-10-17T16:00:01.000Z' },
        { type: 'STATUS_CHANGE', createdAt: '2026-10-20T12:00:00.000Z', fromStatus: 'IN_APPEAL', toStatus: 'FIRM' },
        { type: 'COMMITTEE_HEARING', createdAt: '2026-10-18T10:00:00.000Z' },
      ],
      appeals: [
        {
          kind: AppealKind.REVOCATION,
          isSubsidiary: true,
          filedAt: '2026-10-16T15:00:00.000Z',
          resolvedAt: '2026-10-17T16:00:00.000Z',
          outcome: AppealOutcome.UPHOLD,
        },
        {
          kind: AppealKind.APPEAL,
          isSubsidiary: true,
          filedAt: '2026-10-17T16:00:01.000Z',
          resolvedAt: '2026-10-20T12:00:00.000Z',
          outcome: AppealOutcome.MODIFY,
        },
      ],
      communications: [{ kind: CommunicationKind.APPEAL_RESOLUTION, issuedAt: '2026-10-20T12:05:00.000Z' }],
      notifications: [{ readAt: '2026-10-21T09:00:00.000Z' }],
    });

    expect(timeline.map((item) => item.kind)).toEqual([
      'REVOCATION_FILED',
      'REVOCATION_RESOLVED',
      'SUBSIDIARY_ELEVATED',
      'APPEAL_RESOLVED',
      'NOTIFIED',
      'READ',
    ]);
    expect(timeline.map((item) => item.title).join(' ')).not.toMatch(/comit[eé]/i);
    expect(timeline.find((item) => item.kind === 'REVOCATION_FILED')?.statusLabel).toBe('Presentado');
    expect(timeline.find((item) => item.kind === 'APPEAL_RESOLVED')?.title).toBe('Resolución de apelación');
    expect(timeline.every((item) => item.occurredAt)).toBe(true);
  });

  it('omite etapas que no existen y no marca lectura sin confirmación', () => {
    const timeline = buildAppealTimeline({
      appeals: [
        {
          kind: AppealKind.REVOCATION,
          isSubsidiary: false,
          filedAt: '2026-10-16T15:00:00.000Z',
          resolvedAt: null,
          outcome: null,
        },
      ],
      communications: [{ kind: CommunicationKind.RESOLUTION, issuedAt: '2026-10-15T12:00:00.000Z' }],
      notifications: [{ readAt: null }],
    });
    expect(timeline.map((item) => item.kind)).toEqual(['REVOCATION_FILED']);
  });
});

describe('rebajo del seguimiento', () => {
  it('mantiene el rebajo propuesto mientras el expediente no está firme', () => {
    expect(appealDeduction(DisciplinaryCaseStatus.IN_APPEAL, InfractionSeverity.SERIOUS)).toEqual({
      state: 'PROPOSED',
      points: 20,
      label: 'Rebajo propuesto: 20 puntos',
    });
    expect(appealDeduction(DisciplinaryCaseStatus.FIRM, InfractionSeverity.SERIOUS).state).toBe('APPLIED');
  });
});
