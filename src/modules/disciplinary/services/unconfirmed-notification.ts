import { businessDaysBetween } from '../utils/business-days';
import { canViewAllCases, DisciplinaryActor } from './disciplinary-access.policy';

export const UNCONFIRMED_NOTIFICATION_BUSINESS_DAYS = 2;
export const UNCONFIRMED_NOTIFICATION_ALERT = 'Notificación sin confirmar';

export interface UnconfirmedNotificationFact {
  notificationId: number;
  issuedOn: string;
  readAt: Date | string | null;
}

export interface UnconfirmedNotificationAlert {
  code: 'UNCONFIRMED_NOTIFICATION';
  notificationId: number;
  issuedOn: string;
  message: string;
}

export function unconfirmedNotificationAlerts(
  facts: readonly UnconfirmedNotificationFact[],
  today: string,
  nonWorkingDays: ReadonlySet<string> = new Set(),
): UnconfirmedNotificationAlert[] {
  return facts.flatMap((fact) => {
    if (fact.readAt) return [];
    const elapsed = businessDaysBetween(fact.issuedOn, today, nonWorkingDays);
    if (elapsed < UNCONFIRMED_NOTIFICATION_BUSINESS_DAYS) return [];
    return [
      {
        code: 'UNCONFIRMED_NOTIFICATION' as const,
        notificationId: fact.notificationId,
        issuedOn: fact.issuedOn,
        message: UNCONFIRMED_NOTIFICATION_ALERT,
      },
    ];
  });
}

/** La ve el responsable del expediente y quien tiene acceso a todos. */
export function canSeeUnconfirmedAlert(actor: DisciplinaryActor, responsibleUserId: number | null): boolean {
  if (canViewAllCases(actor)) return true;
  return responsibleUserId != null && responsibleUserId === actor.userId;
}
