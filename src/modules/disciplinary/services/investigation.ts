import { INSTITUTIONAL_ROLE_ADMIN, INSTITUTIONAL_ROLE_DIRECTOR } from '../../../common/constants/institutional-roles.constant';
import { Role } from '../../../common/enums/role.enum';
import { DisciplinaryActor } from './disciplinary-access.policy';

export const INVESTIGATION_BUSINESS_DAYS = 10;
export const OBSERVATION_EVENT = 'OBSERVATION';
export const INFO_REQUEST_EVENT = 'INFO_REQUEST';
export const INFO_RESPONSE_EVENT = 'INFO_RESPONSE';
export const COUNSEL_REQUEST_EVENT = 'COUNSEL_REQUEST';
export const COUNSEL_OPINION_EVENT = 'COUNSEL_OPINION';

/** Docente guía responsable, Dirección o administrador. */
export function canConductInvestigation(
  actor: DisciplinaryActor,
  responsibleUserId: number | null,
): boolean {
  if (actor.roleNames.includes(INSTITUTIONAL_ROLE_ADMIN) || actor.roleNames.includes(Role.ADMIN)) {
    return true;
  }
  if (actor.roleNames.includes(INSTITUTIONAL_ROLE_DIRECTOR)) return true;
  return responsibleUserId != null && responsibleUserId === actor.userId;
}
