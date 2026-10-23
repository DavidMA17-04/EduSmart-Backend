import { CommunicationKind, NotificationEmailStatus } from '../constants/disciplinary.enums';
import { DisciplinaryCommunicationsService } from './disciplinary-communications.service';
import { MANDATORY_CLAUSES } from './disciplinary-clauses';

describe('emisión de comunicación', () => {
  it('crea una notificación por cada encargado vinculado', async () => {
    const saved: Array<{ entity: string; row: Record<string, unknown> }> = [];
    const manager = {
      query: jest.fn().mockResolvedValue([
        { id: 70, email: 'encargado@colegio.cr' },
        { id: 71, email: 'otro@colegio.cr' },
      ]),
      getRepository: (entity: { name: string }) => ({
        create: (row: Record<string, unknown>) => row,
        save: jest.fn(async (row: Record<string, unknown>) => {
          const stored = { id: saved.length + 1, ...row };
          saved.push({ entity: entity.name, row: stored });
          return stored;
        }),
      }),
    };
    const mail = { sendMail: jest.fn() };
    const notifications = { update: jest.fn() };
    const service = new DisciplinaryCommunicationsService(mail as never, notifications as never);

    const issued = await service.issue(manager as never, {
      caseId: 8,
      kind: CommunicationKind.DIRECT_REPRIMAND,
      body: 'Amonestación por uso del celular en clase.',
      issuerUserId: 4,
      studentUserId: 10,
      subject: 'Amonestación AM-2026-0001',
    });

    expect(saved).toHaveLength(3);
    expect(saved[0].row.body).toEqual(expect.stringContaining(MANDATORY_CLAUSES[0]));
    expect(saved[0].row.body).toEqual(expect.stringContaining(MANDATORY_CLAUSES[1]));
    expect(saved.filter((row) => row.entity === 'DisciplinaryNotificationEntity')).toHaveLength(2);
    expect(issued.pending).toHaveLength(2);
    expect(issued.communicationId).toBe(1);
    expect(mail.sendMail).not.toHaveBeenCalled();
  });

  it('si el SMTP no está configurado deja la notificación en SKIPPED', async () => {
    const { SmtpNotConfiguredError } = await import('../../../integrations/mail/mail.service');
    const notifications = { update: jest.fn() };
    const mail = { sendMail: jest.fn().mockRejectedValue(new SmtpNotConfiguredError()) };
    const service = new DisciplinaryCommunicationsService(mail as never, notifications as never);
    await service.dispatch([
      { notificationId: 3, email: 'encargado@colegio.cr', subject: 'Amonestación', text: 'texto' },
    ]);
    expect(notifications.update).not.toHaveBeenCalled();
    expect(mail.sendMail).toHaveBeenCalledTimes(1);
  });

  it('notifica una resolución en la aplicación y deja el correo en SKIPPED si el SMTP no está configurado', async () => {
    const { SmtpNotConfiguredError } = await import('../../../integrations/mail/mail.service');
    const saved: Array<{ entity: string; row: Record<string, unknown> }> = [];
    const manager = {
      query: jest.fn().mockResolvedValue([{ id: 70, email: 'encargado@colegio.cr' }]),
      getRepository: (entity: { name: string }) => ({
        create: (row: Record<string, unknown>) => row,
        save: jest.fn(async (row: Record<string, unknown>) => {
          const stored = { id: saved.length + 1, ...row };
          saved.push({ entity: entity.name, row: stored });
          return stored;
        }),
      }),
    };
    const notifications = { update: jest.fn() };
    const mail = { sendMail: jest.fn().mockRejectedValue(new SmtpNotConfiguredError()) };
    const service = new DisciplinaryCommunicationsService(mail as never, notifications as never);

    const issued = await service.issue(manager as never, {
      caseId: 8,
      kind: CommunicationKind.RESOLUTION,
      body: 'Se resuelve mantener la amonestación escrita.',
      issuerUserId: 2,
      studentUserId: 10,
      subject: 'Resolución AM-2026-0008',
    });
    await expect(service.dispatch(issued.pending)).resolves.toBeUndefined();

    const notification = saved.find((row) => row.entity === 'DisciplinaryNotificationEntity');
    expect(issued.notified).toBe(true);
    expect(notification?.row.emailStatus).toBe(NotificationEmailStatus.SKIPPED);
    expect(notifications.update).not.toHaveBeenCalled();
    expect(mail.sendMail).toHaveBeenCalledTimes(1);
  });

  it('un fallo de correo marca FAILED y no lanza', async () => {
    const notifications = { update: jest.fn() };
    const mail = { sendMail: jest.fn().mockRejectedValue(new Error('smtp down')) };
    const service = new DisciplinaryCommunicationsService(mail as never, notifications as never);
    await expect(
      service.dispatch([
        { notificationId: 3, email: 'encargado@colegio.cr', subject: 'Amonestación', text: 'texto' },
      ]),
    ).resolves.toBeUndefined();
    expect(notifications.update).toHaveBeenCalledWith(3, { emailStatus: NotificationEmailStatus.FAILED });
  });
});
