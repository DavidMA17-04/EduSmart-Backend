import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PERMISSIONS } from '../../common/constants/permissions.constant';
import { INSTITUTIONAL_ROLE_ADMIN } from '../../common/constants/institutional-roles.constant';
import { Role } from '../../common/enums/role.enum';
import { JustificationStatus } from '../../common/enums/justification-status.enum';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { RequestClientMeta } from '../auth/utils/request-client-meta';
import { AbsenteeismService } from '../attendance/services/absenteeism.service';
import { JustificationsService } from '../attendance/services/justifications.service';
import { DisciplinaryNotificationsService } from '../disciplinary/services/disciplinary-notifications.service';
import type { InboxItemDto, InboxMineDto } from './dto/inbox-item.dto';
import {
  INBOX_HREF,
  INBOX_LIMIT,
  InboxSource,
  disciplinaryKindLabel,
} from './inbox.constants';

@Injectable()
export class InboxNotificationsService {
  constructor(
    private readonly disciplinary: DisciplinaryNotificationsService,
    private readonly absenteeism: AbsenteeismService,
    private readonly justifications: JustificationsService,
  ) {}

  async mine(actor: AuthenticatedUser): Promise<InboxMineDto> {
    const batches = await Promise.all([
      this.disciplinaryItems(actor),
      this.absenteeismItems(actor),
      this.justificationItems(actor),
    ]);
    const items = batches
      .flat()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, INBOX_LIMIT);
    return { unreadCount: items.length, items };
  }

  async markRead(
    actor: AuthenticatedUser,
    source: InboxSource,
    id: number,
    meta: RequestClientMeta,
  ) {
    if (source === InboxSource.JUSTIFICATION_PENDING) {
      throw new BadRequestException({
        code: 'INBOX_READ_NOT_SUPPORTED',
        message: 'Las justificaciones pendientes no se marcan leídas desde la campana',
      });
    }
    if (source === InboxSource.DISCIPLINARY) {
      return this.disciplinary.confirmRead(actor, id, meta);
    }
    if (source === InboxSource.ABSENTEEISM) {
      return this.absenteeism.markNotificationRead(actor, id);
    }
    throw new BadRequestException({
      code: 'INBOX_SOURCE_UNKNOWN',
      message: 'Fuente de notificación no válida',
    });
  }

  private async disciplinaryItems(actor: AuthenticatedUser): Promise<InboxItemDto[]> {
    if (!this.hasPermission(actor, PERMISSIONS.DISCIPLINARY_RESPOND)) return [];
    try {
      const inbox = await this.disciplinary.mine(actor);
      return inbox.items
        .filter((item) => item.readAt == null)
        .map((item) => ({
          id: item.id,
          source: InboxSource.DISCIPLINARY,
          title: `${disciplinaryKindLabel(item.kind)} · ${item.studentName}`,
          body: item.caseNumber,
          href: INBOX_HREF[InboxSource.DISCIPLINARY],
          createdAt: item.issuedAt,
          readAt: null,
        }));
    } catch (error) {
      return this.emptyIfForbidden(error);
    }
  }

  private async absenteeismItems(actor: AuthenticatedUser): Promise<InboxItemDto[]> {
    if (!this.isAdmin(actor) && !this.hasPermission(actor, PERMISSIONS.ATTENDANCE_READ)) {
      return [];
    }
    try {
      const rows = await this.absenteeism.listUnreadForInbox(actor, INBOX_LIMIT);
      return rows.map((row) => ({
        id: row.id,
        source: InboxSource.ABSENTEEISM,
        title: row.title,
        body: `${row.studentFullName} · ${row.body}`,
        href: INBOX_HREF[InboxSource.ABSENTEEISM],
        createdAt: row.sentAt,
        readAt: null,
      }));
    } catch (error) {
      return this.emptyIfForbidden(error);
    }
  }

  private async justificationItems(actor: AuthenticatedUser): Promise<InboxItemDto[]> {
    if (!this.isAdmin(actor) && !this.hasPermission(actor, PERMISSIONS.ATTENDANCE_REVIEW)) {
      return [];
    }
    try {
      const page = await this.justifications.getJustifications(
        { status: JustificationStatus.PENDING, page: 1, pageSize: INBOX_LIMIT },
        actor,
      );
      return page.data.map((row) => ({
        id: row.id,
        source: InboxSource.JUSTIFICATION_PENDING,
        title: `Justificación pendiente · ${row.student.fullName}`,
        body: `${row.sessionDate} · ${row.offering.name}`,
        href: INBOX_HREF[InboxSource.JUSTIFICATION_PENDING],
        createdAt: new Date(row.createdAt).toISOString(),
        readAt: null,
      }));
    } catch (error) {
      return this.emptyIfForbidden(error);
    }
  }

  private emptyIfForbidden(error: unknown): InboxItemDto[] {
    if (error instanceof ForbiddenException) return [];
    throw error;
  }

  private isAdmin(actor: AuthenticatedUser): boolean {
    const roles = (actor.roles ?? []).map(String);
    return roles.includes(Role.ADMIN) || roles.includes(INSTITUTIONAL_ROLE_ADMIN);
  }

  private hasPermission(actor: AuthenticatedUser, code: string): boolean {
    if (this.isAdmin(actor)) return true;
    return (actor.permissions ?? []).includes(code);
  }
}
