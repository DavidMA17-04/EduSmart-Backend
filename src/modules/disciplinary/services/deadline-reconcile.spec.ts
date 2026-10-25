import { AppealKind, AppealOutcome, DisciplinaryCaseStatus, DisciplinaryTrack, ResolutionOutcome } from '../constants/disciplinary.enums';
import {
  DeadlineSnapshot,
  FIRM_NOTE,
  isSubsidiaryAwaitingElevation,
  NO_DEFENSE_NOTE,
  planDeadline,
} from './deadline-reconcile';

function snapshot(partial: Partial<DeadlineSnapshot> & Pick<DeadlineSnapshot, 'status'>): DeadlineSnapshot {
  return {
    track: DisciplinaryTrack.DUE_PROCESS,
    stepStartedOn: '2026-10-14',
    stepBusinessDays: 3,
    resolutionOutcome: null,
    defenseFiled: false,
    appealOpen: false,
    subsidiaryAwaitingElevation: false,
    revocationRejectedOn: null,
    ...partial,
  };
}

describe('reconciliación de plazos', () => {
  it('el descargo vencido pasa a pendiente de resolución con la marca Sin descargo', () => {
    const open = snapshot({ status: DisciplinaryCaseStatus.COMMUNICATED });
    expect(planDeadline(open, '2026-10-19')).toBeNull();
    const plan = planDeadline(open, '2026-10-20');
    expect(plan).toMatchObject({
      type: 'TRANSITION',
      to: DisciplinaryCaseStatus.PENDING_RESOLUTION,
      effectiveOn: '2026-10-19',
      note: NO_DEFENSE_NOTE,
      stepBusinessDays: 5,
    });
    expect(planDeadline(snapshot({ status: DisciplinaryCaseStatus.PENDING_RESOLUTION }), '2026-10-20')).toBeNull();
  });

  it('un feriado corre el vencimiento del descargo', () => {
    const plan = planDeadline(
      snapshot({ status: DisciplinaryCaseStatus.COMMUNICATED }),
      '2026-10-21',
      new Set(['2026-10-19']),
    );
    expect(plan).toMatchObject({ effectiveOn: '2026-10-20' });
  });

  it('sin recurso, la resolución queda firme en la fecha de vencimiento', () => {
    const resolved = snapshot({
      status: DisciplinaryCaseStatus.RESOLVED,
      resolutionOutcome: ResolutionOutcome.UPHOLD,
    });
    expect(planDeadline(resolved, '2026-10-19')).toBeNull();
    expect(planDeadline(resolved, '2026-10-20')).toMatchObject({
      type: 'TRANSITION',
      to: DisciplinaryCaseStatus.FIRM,
      effectiveOn: '2026-10-19',
      note: FIRM_NOTE,
      firm: true,
    });
    expect(
      planDeadline(
        snapshot({ status: DisciplinaryCaseStatus.RESOLVED, resolutionOutcome: ResolutionOutcome.DISMISS }),
        '2026-10-20',
      ),
    ).toMatchObject({ to: DisciplinaryCaseStatus.DISMISSED, firm: false });
    expect(planDeadline(snapshot({ status: DisciplinaryCaseStatus.FIRM }), '2026-11-01')).toBeNull();
  });

  it('la amonestación directa notificada queda firme al vencer la revocatoria', () => {
    const plan = planDeadline(
      snapshot({ status: DisciplinaryCaseStatus.NOTIFIED, track: DisciplinaryTrack.DIRECT }),
      '2026-10-20',
    );
    expect(plan).toMatchObject({ to: DisciplinaryCaseStatus.FIRM, effectiveOn: '2026-10-19' });
  });

  it('no declara firme un expediente que ya tiene un recurso abierto', () => {
    expect(
      planDeadline(
        snapshot({ status: DisciplinaryCaseStatus.RESOLVED, appealOpen: true }),
        '2026-10-20',
      ),
    ).toBeNull();
  });

  it('la revocatoria rechazada con apelación en subsidio se eleva una sola vez', () => {
    const appeals = [
      {
        kind: AppealKind.REVOCATION,
        isSubsidiary: true,
        outcome: AppealOutcome.UPHOLD,
        resolvedOn: '2026-10-21',
      },
    ];
    expect(isSubsidiaryAwaitingElevation(appeals, false)).toEqual({
      pending: true,
      rejectedOn: '2026-10-21',
    });
    expect(isSubsidiaryAwaitingElevation(appeals, true).pending).toBe(false);

    const plan = planDeadline(
      snapshot({
        status: DisciplinaryCaseStatus.IN_APPEAL,
        subsidiaryAwaitingElevation: true,
        revocationRejectedOn: '2026-10-21',
        stepBusinessDays: 3,
      }),
      '2026-10-21',
    );
    expect(plan).toEqual({
      type: 'ELEVATE_SUBSIDIARY',
      effectiveOn: '2026-10-21',
      businessDays: 8,
    });
    expect(
      planDeadline(
        snapshot({
          status: DisciplinaryCaseStatus.IN_APPEAL,
          subsidiaryAwaitingElevation: false,
          appealOpen: true,
          stepBusinessDays: 8,
          stepStartedOn: '2026-10-21',
        }),
        '2026-10-22',
      ),
    ).toBeNull();
  });
});
