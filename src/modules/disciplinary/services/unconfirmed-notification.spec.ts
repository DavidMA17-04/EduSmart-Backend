import { businessDaysBetween } from '../utils/business-days';
import { UNCONFIRMED_NOTIFICATION_ALERT, unconfirmedNotificationAlerts } from './unconfirmed-notification';

describe('notificación sin confirmar', () => {
  it('avisa cuando ya pasaron 2 días hábiles y no si se confirmó la lectura', () => {
    const open = unconfirmedNotificationAlerts(
      [{ notificationId: 4, issuedOn: '2026-10-14', readAt: null }],
      '2026-10-16',
    );
    expect(open).toEqual([
      {
        code: 'UNCONFIRMED_NOTIFICATION',
        notificationId: 4,
        issuedOn: '2026-10-14',
        message: UNCONFIRMED_NOTIFICATION_ALERT,
      },
    ]);
    expect(
      unconfirmedNotificationAlerts(
        [{ notificationId: 4, issuedOn: '2026-10-16', readAt: null }],
        '2026-10-19',
      ),
    ).toEqual([]);
    expect(
      unconfirmedNotificationAlerts(
        [{ notificationId: 4, issuedOn: '2026-10-14', readAt: new Date('2026-10-16T18:00:00.000Z') }],
        '2026-10-19',
      ),
    ).toEqual([]);
  });

  it('un feriado corre el conteo de los 2 días hábiles', () => {
    const withHoliday = unconfirmedNotificationAlerts(
      [{ notificationId: 4, issuedOn: '2026-10-14', readAt: null }],
      '2026-10-16',
      new Set(['2026-10-15']),
    );
    expect(withHoliday).toEqual([]);
    expect(businessDaysBetween('2026-10-14', '2026-10-19', new Set(['2026-10-15']))).toBe(2);
    expect(
      unconfirmedNotificationAlerts(
        [{ notificationId: 4, issuedOn: '2026-10-14', readAt: null }],
        '2026-10-19',
        new Set(['2026-10-15']),
      ),
    ).toHaveLength(1);
  });
});
