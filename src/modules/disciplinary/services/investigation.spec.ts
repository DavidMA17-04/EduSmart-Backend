import { INSTITUTIONAL_ROLE_DIRECTOR } from '../../../common/constants/institutional-roles.constant';
import { DisciplinaryActor } from './disciplinary-access.policy';
import { canConductInvestigation } from './investigation';

const actor = (partial: Partial<DisciplinaryActor>): DisciplinaryActor => ({
  userId: 4,
  permissions: [],
  roleNames: ['Docente'],
  guideGroupIds: [],
  linkedStudentIds: [],
  ...partial,
});

describe('canConductInvestigation', () => {
  it('permite al docente guía responsable, a Dirección y al administrador', () => {
    expect(canConductInvestigation(actor({ userId: 7 }), 7)).toBe(true);
    expect(canConductInvestigation(actor({ roleNames: [INSTITUTIONAL_ROLE_DIRECTOR] }), 7)).toBe(true);
    expect(canConductInvestigation(actor({ roleNames: ['Administrador'] }), null)).toBe(true);
  });

  it('niega a otro docente y a Orientación', () => {
    expect(canConductInvestigation(actor({ userId: 4 }), 7)).toBe(false);
    expect(canConductInvestigation(actor({ roleNames: ['Orientador'] }), 7)).toBe(false);
    expect(canConductInvestigation(actor({ userId: 4 }), null)).toBe(false);
  });
});
