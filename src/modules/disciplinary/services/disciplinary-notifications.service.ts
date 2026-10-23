import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RequestClientMeta } from '../../auth/utils/request-client-meta';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { actorCanListCases } from './case-read';
import { DisciplinaryActor } from './disciplinary-access.policy';
import { personName, readReceiptLabel } from './read-receipt';

interface InboxRow {
  id: number;
  communicationId: number;
  caseId: number;
  caseNumber: string;
  kind: string;
  studentUserId: number;
  studentName: string | null;
  studentFirstLastname: string | null;
  studentSecondLastname: string | null;
  issuedAt: Date;
  readAt: Date | null;
}

interface ReceiptRow extends InboxRow {
  readIp: string | null;
  readUserAgent: string | null;
  guardianName: string | null;
  guardianFirstLastname: string | null;
  guardianSecondLastname: string | null;
}

@Injectable()
export class DisciplinaryNotificationsService {
  constructor(private readonly dataSource: DataSource) {}

  async mine(actorUser: AuthenticatedUser) {
    this.assertCanOpen(actorUser);
    const rows = (await this.dataSource.query(
      `
      SELECT n.id_disciplinary_notifications AS id,
             n.id_disciplinary_communications AS communicationId,
             c.id_disciplinary_cases AS caseId,
             c.case_number AS caseNumber,
             comm.kind AS kind,
             c.id_users_student AS studentUserId,
             u.name AS studentName,
             u.first_lastname AS studentFirstLastname,
             u.second_lastname AS studentSecondLastname,
             comm.issued_at AS issuedAt,
             n.read_at AS readAt
      FROM disciplinary_notifications n
      INNER JOIN disciplinary_communications comm
        ON comm.id_disciplinary_communications = n.id_disciplinary_communications
      INNER JOIN disciplinary_cases c ON c.id_disciplinary_cases = comm.id_disciplinary_cases
      INNER JOIN guardian_student_links l
        ON l.id_users_guardian = n.id_users_guardian
       AND l.id_users_student = c.id_users_student
      INNER JOIN users u ON u.id_users = c.id_users_student
      WHERE n.id_users_guardian = ?
      ORDER BY comm.issued_at DESC, n.id_disciplinary_notifications DESC
      `,
      [actorUser.id],
    )) as InboxRow[];
    const items = rows.map((row) => this.toItem(row));
    return {
      unreadCount: items.filter((item) => item.readAt == null).length,
      items,
    };
  }

  async confirmRead(actorUser: AuthenticatedUser, notificationId: number, meta: RequestClientMeta) {
    this.assertCanOpen(actorUser);
    const current = await this.findOwn(actorUser.id, notificationId);
    if (current.readAt) return this.toReceipt(current);
    await this.dataSource.query(
      `
      UPDATE disciplinary_notifications
      SET read_at = ?, read_ip = ?, read_user_agent = ?
      WHERE id_disciplinary_notifications = ?
        AND id_users_guardian = ?
        AND read_at IS NULL
      `,
      [new Date(), clip(meta.ipAddress, 45), clip(meta.userAgent, 255), notificationId, actorUser.id],
    );
    return this.toReceipt(await this.findOwn(actorUser.id, notificationId));
  }

  private async findOwn(guardianUserId: number, notificationId: number): Promise<ReceiptRow> {
    const rows = (await this.dataSource.query(
      `
      SELECT n.id_disciplinary_notifications AS id,
             n.id_disciplinary_communications AS communicationId,
             c.id_disciplinary_cases AS caseId,
             c.case_number AS caseNumber,
             comm.kind AS kind,
             c.id_users_student AS studentUserId,
             stu.name AS studentName,
             stu.first_lastname AS studentFirstLastname,
             stu.second_lastname AS studentSecondLastname,
             comm.issued_at AS issuedAt,
             n.read_at AS readAt,
             n.read_ip AS readIp,
             n.read_user_agent AS readUserAgent,
             g.name AS guardianName,
             g.first_lastname AS guardianFirstLastname,
             g.second_lastname AS guardianSecondLastname
      FROM disciplinary_notifications n
      INNER JOIN disciplinary_communications comm
        ON comm.id_disciplinary_communications = n.id_disciplinary_communications
      INNER JOIN disciplinary_cases c ON c.id_disciplinary_cases = comm.id_disciplinary_cases
      INNER JOIN guardian_student_links l
        ON l.id_users_guardian = n.id_users_guardian
       AND l.id_users_student = c.id_users_student
      INNER JOIN users stu ON stu.id_users = c.id_users_student
      INNER JOIN users g ON g.id_users = n.id_users_guardian
      WHERE n.id_disciplinary_notifications = ?
        AND n.id_users_guardian = ?
      LIMIT 1
      `,
      [notificationId, guardianUserId],
    )) as ReceiptRow[];
    const row = rows[0];
    if (!row) {
      throw new NotFoundException({
        code: 'NOTIFICATION_NOT_FOUND',
        message: 'La notificación no existe',
      });
    }
    return row;
  }

  private assertCanOpen(actorUser: AuthenticatedUser): void {
    if (!actorCanListCases(this.asActor(actorUser))) {
      throw new ForbiddenException('No tiene acceso a las notificaciones disciplinarias');
    }
  }

  private asActor(actor: AuthenticatedUser): DisciplinaryActor {
    return {
      userId: actor.id,
      permissions: actor.permissions ?? [],
      roleNames: (actor.roles ?? []).map(String),
      guideGroupIds: [],
      linkedStudentIds: [],
    };
  }

  private toItem(row: InboxRow) {
    return {
      id: Number(row.id),
      communicationId: Number(row.communicationId),
      caseId: Number(row.caseId),
      caseNumber: row.caseNumber,
      kind: row.kind,
      studentUserId: Number(row.studentUserId),
      studentName: personName({
        name: row.studentName,
        firstLastname: row.studentFirstLastname,
        secondLastname: row.studentSecondLastname,
      }),
      issuedAt: new Date(row.issuedAt).toISOString(),
      readAt: row.readAt ? new Date(row.readAt).toISOString() : null,
    };
  }

  private toReceipt(row: ReceiptRow) {
    const readAt = new Date(row.readAt as Date);
    const guardianName = personName({
      name: row.guardianName,
      firstLastname: row.guardianFirstLastname,
      secondLastname: row.guardianSecondLastname,
    });
    return {
      id: Number(row.id),
      caseId: Number(row.caseId),
      readAt: readAt.toISOString(),
      readIp: row.readIp,
      readUserAgent: row.readUserAgent,
      label: readReceiptLabel(guardianName || 'el encargado', readAt),
    };
  }
}

function clip(value: string | null, max: number): string | null {
  const text = value?.trim();
  if (!text) return null;
  return text.slice(0, max);
}
