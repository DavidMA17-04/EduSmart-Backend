import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { MailService, SmtpNotConfiguredError } from '../../../integrations/mail/mail.service';
import { CommunicationKind, NotificationEmailStatus } from '../constants/disciplinary.enums';
import {
  DisciplinaryCommunicationEntity,
  DisciplinaryNotificationEntity,
} from '../entities/disciplinary-communication.entity';
import { emailStatusFor, withMandatoryClauses } from './disciplinary-clauses';

export interface IssueCommunicationInput {
  caseId: number;
  kind: CommunicationKind;
  body: string;
  issuerUserId: number;
  issuedAt?: Date;
  studentUserId: number;
  subject: string;
}

export interface PendingDisciplinaryMail {
  notificationId: number;
  email: string;
  subject: string;
  text: string;
}

interface GuardianRow {
  id: number;
  email: string | null;
}

@Injectable()
export class DisciplinaryCommunicationsService {
  private readonly logger = new Logger(DisciplinaryCommunicationsService.name);

  constructor(
    private readonly mail: MailService,
    @InjectRepository(DisciplinaryNotificationEntity)
    private readonly notifications: Repository<DisciplinaryNotificationEntity>,
  ) {}

  /**
   * Crea la comunicación y una notificación por encargado dentro de la transacción.
   * El correo se envía después, con `dispatch`.
   */
  async issue(
    manager: EntityManager,
    input: IssueCommunicationInput,
  ): Promise<{ communicationId: number; pending: PendingDisciplinaryMail[]; notified: boolean }> {
    const issuedAt = input.issuedAt ?? new Date();
    const body = withMandatoryClauses(input.body);
    const communications = manager.getRepository(DisciplinaryCommunicationEntity);
    const saved = await communications.save(
      communications.create({
        caseId: input.caseId,
        kind: input.kind,
        body,
        issuerUserId: input.issuerUserId,
        issuedAt,
      }),
    );

    const guardians = await this.loadGuardians(manager, input.studentUserId);

    const notificationRepo = manager.getRepository(DisciplinaryNotificationEntity);
    const pending: PendingDisciplinaryMail[] = [];
    for (const guardian of guardians) {
      const notification = await notificationRepo.save(
        notificationRepo.create({
          communicationId: saved.id,
          guardianUserId: Number(guardian.id),
          emailStatus: NotificationEmailStatus.SKIPPED,
        }),
      );
      if (guardian.email) {
        pending.push({
          notificationId: notification.id,
          email: guardian.email,
          subject: input.subject,
          text: body,
        });
      }
    }
    return { communicationId: saved.id, pending, notified: guardians.length > 0 };
  }

  async loadGuardians(manager: EntityManager, studentUserId: number): Promise<GuardianRow[]> {
    const rows = (await manager.query(
      `
      SELECT u.id_users AS id, u.email AS email
      FROM guardian_student_links l
      INNER JOIN users u ON u.id_users = l.id_users_guardian
      WHERE l.id_users_student = ?
    `,
      [studentUserId],
    )) as GuardianRow[];
    return rows.map((row) => ({ id: Number(row.id), email: row.email }));
  }

  /** Correo después del commit. Un fallo no revierte el expediente. */
  async dispatch(pending: readonly PendingDisciplinaryMail[]): Promise<void> {
    for (const item of pending) {
      try {
        await this.mail.sendMail({ to: item.email, subject: item.subject, text: item.text });
        await this.notifications.update(item.notificationId, { emailStatus: NotificationEmailStatus.SENT });
      } catch (error) {
        const status = emailStatusFor(error);
        if (status === NotificationEmailStatus.FAILED) {
          this.logger.warn(`Correo disciplinario no enviado (${item.notificationId})`);
          await this.notifications.update(item.notificationId, { emailStatus: status });
        }
      }
    }
  }
}

export { SmtpNotConfiguredError };
