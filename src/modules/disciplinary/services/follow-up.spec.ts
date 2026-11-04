import { INSTITUTIONAL_ROLE_COUNSELOR, INSTITUTIONAL_ROLE_DIRECTOR } from '../../../common/constants/institutional-roles.constant';
import { DisciplinaryActor } from './disciplinary-access.policy';
import { canRegisterFollowUp, pendingReminders } from './follow-up';

const actor = (partial: Partial<DisciplinaryActor>): DisciplinaryActor => ({
  userId: 4,
  permissions: [],
  roleNames: ['Docente'],
  guideGroupIds: [],
  linkedStudentIds: [],
  ...partial,
});

describe('canRegisterFollowUp', () => {
  it('permite al guía responsable, a Orientación y a Dirección', () => {
    expect(canRegisterFollowUp(actor({ userId: 7 }), 7)).toBe(true);
    expect(canRegisterFollowUp(actor({ roleNames: [INSTITUTIONAL_ROLE_COUNSELOR] }), 7)).toBe(true);
    expect(canRegisterFollowUp(actor({ roleNames: [INSTITUTIONAL_ROLE_DIRECTOR] }), null)).toBe(true);
  });

  it('niega a un docente que no es el responsable', () => {
    expect(canRegisterFollowUp(actor({ userId: 4 }), 7)).toBe(false);
  });
});

describe('pendingReminders', () => {
  const row = {
    id: 5,
    caseId: 3,
    reviewOn: '2026-10-19',
    responsibleUserId: 7,
    authorUserId: 7,
  };

  it('avisa el día de la revisión y no repite un recordatorio ya enviado', () => {
    expect(pendingReminders([row], '2026-10-19', new Set())).toEqual([row]);
    expect(pendingReminders([row], '2026-10-18', new Set())).toEqual([]);
    expect(pendingReminders([row], '2026-10-19', new Set([5]))).toEqual([]);
  });
});
