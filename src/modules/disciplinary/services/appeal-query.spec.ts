import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { INSTITUTIONAL_ROLE_ADMIN, INSTITUTIONAL_ROLE_DIRECTOR } from '../../../common/constants/institutional-roles.constant';
import { AppealKind, AppealOutcome, DisciplinaryCaseStatus, DisciplinaryTrack } from '../constants/disciplinary.enums';
import { DisciplinaryActor } from './disciplinary-access.policy';
import {
  actorCanReviewQueue,
  canFileDisciplinaryRemedy,
  canResolveDisciplinaryAppeal,
  canResolveDisciplinaryRevocation,
  canReviewPendingAppeal,
  eligibleRemedyKind,
  isRemedyOnTime,
  isRevocationStage,
  isStandaloneAppealStage,
} from './appeal-query';

const TODAY = '2026-10-17';

const actor = (partial: Partial<DisciplinaryActor>): DisciplinaryActor => ({
  userId: 8,
  permissions: [PERMISSIONS.DISCIPLINARY_VIEW_OWN],
  roleNames: ['Docente'],
  guideGroupIds: [],
  linkedStudentIds: [],
  ...partial,
});

describe('appeal-query — equivalencia con Sprint 4', () => {
  it('la ventana de revocatoria es DIRECT+NOTIFIED o DUE_PROCESS+RESOLVED', () => {
    expect(isRevocationStage(DisciplinaryTrack.DIRECT, DisciplinaryCaseStatus.NOTIFIED)).toBe(true);
    expect(isRevocationStage(DisciplinaryTrack.DUE_PROCESS, DisciplinaryCaseStatus.RESOLVED)).toBe(true);
    expect(isRevocationStage(DisciplinaryTrack.DUE_PROCESS, DisciplinaryCaseStatus.NOTIFIED)).toBe(false);
    expect(isRevocationStage(DisciplinaryTrack.DIRECT, DisciplinaryCaseStatus.IN_APPEAL)).toBe(false);
  });

  it('la apelación standalone solo cabe tras revocatoria rechazada, sin subsidio y sin APPEAL', () => {
    const upheld = [{ kind: AppealKind.REVOCATION, isSubsidiary: false, outcome: AppealOutcome.UPHOLD }];
    expect(isStandaloneAppealStage(DisciplinaryCaseStatus.IN_APPEAL, upheld)).toBe(true);
    expect(
      isStandaloneAppealStage(DisciplinaryCaseStatus.IN_APPEAL, [
        { kind: AppealKind.REVOCATION, isSubsidiary: true, outcome: AppealOutcome.UPHOLD },
      ]),
    ).toBe(false);
    expect(
      isStandaloneAppealStage(DisciplinaryCaseStatus.IN_APPEAL, [
        ...upheld,
        { kind: AppealKind.APPEAL, isSubsidiary: false, outcome: null },
      ]),
    ).toBe(false);
    expect(isStandaloneAppealStage(DisciplinaryCaseStatus.RESOLVED, upheld)).toBe(false);
  });

  it('el reloj del expediente coincide con assertOnTime: 15+3 cabe el 17 y 13+3 no', () => {
    expect(isRemedyOnTime('2026-10-15', 3, TODAY)).toBe(true);
    expect(isRemedyOnTime('2026-10-13', 3, TODAY)).toBe(false);
    expect(isRemedyOnTime('2026-10-15', 0, TODAY)).toBe(false);
    expect(isRemedyOnTime('', 3, TODAY)).toBe(false);
  });

  it('solo interpone el encargado vinculado, el responsable, Dirección o admin', () => {
    const guardian = actor({ userId: 70, roleNames: ['Encargado'], linkedStudentIds: [10] });
    const responsible = actor({ userId: 7 });
    const director = actor({ userId: 2, roleNames: [INSTITUTIONAL_ROLE_DIRECTOR] });
    const admin = actor({ userId: 1, roleNames: [INSTITUTIONAL_ROLE_ADMIN] });
    const stranger = actor({ userId: 8 });

    expect(canFileDisciplinaryRemedy(guardian, 10, 7)).toBe(true);
    expect(canFileDisciplinaryRemedy(guardian, 20, 7)).toBe(false);
    expect(canFileDisciplinaryRemedy(responsible, 10, 7)).toBe(true);
    expect(canFileDisciplinaryRemedy(director, 10, 7)).toBe(true);
    expect(canFileDisciplinaryRemedy(admin, 10, 7)).toBe(true);
    expect(canFileDisciplinaryRemedy(stranger, 10, 7)).toBe(false);
  });

  it('un expediente en ventana y en plazo es elegible; el vencido o el no legitimado no', () => {
    const resolved = {
      track: DisciplinaryTrack.DUE_PROCESS,
      status: DisciplinaryCaseStatus.RESOLVED,
      stepStartedOn: '2026-10-15',
      stepBusinessDays: 3,
      appeals: [] as const,
    };
    expect(eligibleRemedyKind(resolved, TODAY)).toBe(AppealKind.REVOCATION);
    expect(eligibleRemedyKind({ ...resolved, stepStartedOn: '2026-10-13' }, TODAY)).toBeNull();

    const afterUphold = {
      track: DisciplinaryTrack.DUE_PROCESS,
      status: DisciplinaryCaseStatus.IN_APPEAL,
      stepStartedOn: '2026-10-15',
      stepBusinessDays: 3,
      appeals: [{ kind: AppealKind.REVOCATION, isSubsidiary: false, outcome: AppealOutcome.UPHOLD }],
    };
    expect(eligibleRemedyKind(afterUphold, TODAY)).toBe(AppealKind.APPEAL);
    expect(
      eligibleRemedyKind(
        {
          ...afterUphold,
          appeals: [{ kind: AppealKind.REVOCATION, isSubsidiary: true, outcome: AppealOutcome.UPHOLD }],
        },
        TODAY,
      ),
    ).toBeNull();
  });

  it('la revisión usa permisos y responsable, no el nombre del rol', () => {
    const guide = actor({
      userId: 7,
      permissions: [PERMISSIONS.DISCIPLINARY_RESOLVE, PERMISSIONS.DISCIPLINARY_VIEW_OWN],
    });
    const foreign = actor({
      userId: 8,
      permissions: [PERMISSIONS.DISCIPLINARY_RESOLVE, PERMISSIONS.DISCIPLINARY_VIEW_OWN],
    });
    const director = actor({
      userId: 2,
      roleNames: [INSTITUTIONAL_ROLE_DIRECTOR],
      permissions: [PERMISSIONS.DISCIPLINARY_APPEAL, PERMISSIONS.DISCIPLINARY_READ],
    });
    const admin = actor({ userId: 1, roleNames: [INSTITUTIONAL_ROLE_ADMIN], permissions: [] });

    expect(canResolveDisciplinaryRevocation(guide, 7)).toBe(true);
    expect(canResolveDisciplinaryRevocation(foreign, 7)).toBe(false);
    expect(canResolveDisciplinaryAppeal(director)).toBe(true);
    expect(canResolveDisciplinaryAppeal(guide)).toBe(false);
    expect(canReviewPendingAppeal(guide, AppealKind.REVOCATION, null, 7)).toBe(true);
    expect(canReviewPendingAppeal(guide, AppealKind.APPEAL, null, 7)).toBe(false);
    expect(canReviewPendingAppeal(director, AppealKind.APPEAL, null, 7)).toBe(true);
    expect(canReviewPendingAppeal(director, AppealKind.REVOCATION, null, 7)).toBe(false);
    expect(canReviewPendingAppeal(admin, AppealKind.REVOCATION, null, 7)).toBe(true);
    expect(canReviewPendingAppeal(guide, AppealKind.REVOCATION, AppealOutcome.UPHOLD, 7)).toBe(false);
    expect(actorCanReviewQueue(guide)).toBe(true);
    expect(actorCanReviewQueue(actor({ permissions: [PERMISSIONS.DISCIPLINARY_VIEW_OWN] }))).toBe(false);
  });
});
