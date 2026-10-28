import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CommunicationsRepository,
  CommunicationView,
  FeedCommunicationItem,
  toCommunicationView,
} from '../repositories/communications.repository';
import { CommunicationTargetingService } from './communication-targeting.service';
import { ReadingConfirmationService } from './reading-confirmation.service';
import { CreateCommunicationDto } from '../dto/create-communication.dto';
import { UpdateCommunicationDto } from '../dto/update-communication.dto';
import { CommunicationFilterDto } from '../dto/communication-filter.dto';
import { CommunicationTargetDto } from '../dto/communication-target.dto';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import {
  CommunicationPriority,
  CommunicationStatus,
} from '../entities/communication.entity';
import { RecipientType } from '../entities/communication-recipient.entity';

function hasManagePermission(user: AuthenticatedUser): boolean {
  return (
    user.permissions.includes('communications.manage') ||
    user.roles.some((r) => {
      const lower = String(r).toLowerCase();
      return lower.includes('admin') || lower.includes('director');
    })
  );
}

/** Normaliza destinatarios: descarta vacíos y exige targetId fuera de ALL. */
function normalizeRecipients(
  recipients: CommunicationTargetDto[] | undefined,
): CommunicationTargetDto[] {
  if (!recipients || recipients.length === 0) {
    return [{ recipientType: RecipientType.ALL }];
  }
  if (recipients.some((r) => r.recipientType === RecipientType.ALL)) {
    return [{ recipientType: RecipientType.ALL }];
  }
  const cleaned = recipients.filter((r) => r.targetId && String(r.targetId).trim() !== '');
  if (cleaned.length === 0) {
    throw new BadRequestException('Seleccione al menos un destinatario para el comunicado.');
  }
  const seen = new Set<string>();
  return cleaned.filter((r) => {
    const key = `${r.recipientType}:${r.targetId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function assertDates(publishDate: Date | null, expirationDate: Date | null): void {
  if (expirationDate && publishDate && expirationDate.getTime() <= publishDate.getTime()) {
    throw new BadRequestException(
      'La fecha de vigencia debe ser posterior a la fecha de publicación.',
    );
  }
}

@Injectable()
export class CommunicationsService {
  constructor(
    private readonly repository: CommunicationsRepository,
    private readonly targetingService: CommunicationTargetingService,
    private readonly readingService: ReadingConfirmationService,
  ) {}

  private async loadView(id: string): Promise<CommunicationView> {
    const comm = await this.repository.findById(id);
    if (!comm) {
      throw new NotFoundException('Comunicado no encontrado');
    }
    const [view] = await this.repository.attachGroupLabels([toCommunicationView(comm)]);
    return view;
  }

  async create(dto: CreateCommunicationDto, authorId: number): Promise<CommunicationView> {
    const status = dto.status ?? CommunicationStatus.DRAFT;
    const isPublished = status === CommunicationStatus.PUBLISHED;
    const publishDate = dto.publishDate
      ? new Date(dto.publishDate)
      : isPublished
        ? new Date()
        : null;
    const expirationDate = dto.expirationDate ? new Date(dto.expirationDate) : null;
    assertDates(publishDate ?? new Date(), expirationDate);

    const recipients = normalizeRecipients(dto.recipients);

    const communication = await this.repository.create({
      title: dto.title.trim(),
      content: dto.content.trim(),
      priority: dto.priority ?? CommunicationPriority.NORMAL,
      status,
      requiresAcknowledgment: Boolean(dto.requiresAcknowledgment),
      publishDate,
      expirationDate,
      authorId,
    });

    await this.targetingService.setTargets(communication.id, recipients);

    return this.loadView(communication.id);
  }

  async findFeed(filter: CommunicationFilterDto, user: AuthenticatedUser) {
    const context = await this.targetingService.getUserTargetContext(user.id, user.roles);

    return this.repository.findFeedForUser(
      { userId: user.id, roleNames: context.roleNames, groupIds: context.groupIds },
      filter,
    );
  }

  async findAdminList(filter: CommunicationFilterDto, user: AuthenticatedUser) {
    const authorLimit = hasManagePermission(user) ? undefined : user.id;
    return this.repository.findAdminList(filter, authorLimit);
  }

  /**
   * Detalle de un comunicado. Si está publicado se registra la lectura del
   * usuario y se devuelve su estado de lectura/acuse.
   */
  async findOne(id: string, user: AuthenticatedUser): Promise<FeedCommunicationItem> {
    const comm = await this.repository.findById(id);
    if (!comm) {
      throw new NotFoundException('Comunicado no encontrado');
    }

    if (comm.status !== CommunicationStatus.PUBLISHED) {
      const canSeeUnpublished = comm.authorId === user.id || hasManagePermission(user);
      if (!canSeeUnpublished) {
        throw new NotFoundException('Comunicado no encontrado');
      }
      const [draftView] = await this.repository.attachGroupLabels([toCommunicationView(comm)]);
      return {
        ...draftView,
        isRead: false,
        readAt: null,
        isAcknowledged: false,
        acknowledgedAt: null,
      };
    }

    const read = await this.readingService.markAsRead(id, user.id);
    const [view] = await this.repository.attachGroupLabels([toCommunicationView(comm)]);
    return {
      ...view,
      isRead: true,
      readAt: read.readAt,
      isAcknowledged: Boolean(read.acknowledgedAt),
      acknowledgedAt: read.acknowledgedAt,
    };
  }

  async update(
    id: string,
    dto: UpdateCommunicationDto,
    user: AuthenticatedUser,
  ): Promise<CommunicationView> {
    const comm = await this.repository.findById(id);
    if (!comm) {
      throw new NotFoundException('Comunicado no encontrado');
    }

    if (comm.authorId !== user.id && !hasManagePermission(user)) {
      throw new ForbiddenException('No tienes permiso para modificar este comunicado');
    }

    if (dto.title !== undefined) comm.title = dto.title.trim();
    if (dto.content !== undefined) comm.content = dto.content.trim();
    if (dto.priority !== undefined) comm.priority = dto.priority;
    if (dto.requiresAcknowledgment !== undefined) {
      comm.requiresAcknowledgment = Boolean(dto.requiresAcknowledgment);
    }
    if (dto.publishDate !== undefined) {
      comm.publishDate = dto.publishDate ? new Date(dto.publishDate) : null;
    }
    if (dto.expirationDate !== undefined) {
      comm.expirationDate = dto.expirationDate ? new Date(dto.expirationDate) : null;
    }
    if (dto.status !== undefined) {
      comm.status = dto.status;
      if (dto.status === CommunicationStatus.PUBLISHED && !comm.publishDate) {
        comm.publishDate = new Date();
      }
    }

    assertDates(comm.publishDate ?? comm.createdAt, comm.expirationDate);

    // Evitar que TypeORM intente re-guardar relaciones cargadas.
    delete comm.recipients;
    delete comm.author;
    await this.repository.save(comm);

    if (dto.recipients) {
      await this.targetingService.setTargets(comm.id, normalizeRecipients(dto.recipients));
    }

    return this.loadView(id);
  }

  async publish(id: string, user: AuthenticatedUser): Promise<CommunicationView> {
    return this.update(id, { status: CommunicationStatus.PUBLISHED }, user);
  }

  async archive(id: string, user: AuthenticatedUser): Promise<CommunicationView> {
    return this.update(id, { status: CommunicationStatus.ARCHIVED }, user);
  }

  async remove(id: string, user: AuthenticatedUser): Promise<{ success: boolean }> {
    const comm = await this.repository.findById(id);
    if (!comm) {
      throw new NotFoundException('Comunicado no encontrado');
    }

    if (comm.authorId !== user.id && !hasManagePermission(user)) {
      throw new ForbiddenException('No tienes permiso para eliminar este comunicado');
    }

    await this.repository.delete(id);
    return { success: true };
  }

  async getTargetOptions() {
    return this.targetingService.getTargetOptions();
  }

  async estimateAudience(recipients: CommunicationTargetDto[]): Promise<{ total: number }> {
    const normalized = normalizeRecipients(recipients).map((r) => ({
      recipientType: r.recipientType,
      targetId: r.targetId ?? null,
    }));
    return { total: await this.repository.estimateAudience(normalized) };
  }
}
