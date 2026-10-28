import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository, SelectQueryBuilder } from 'typeorm';
import {
  Communication,
  CommunicationPriority,
  CommunicationStatus,
} from '../entities/communication.entity';
import { CommunicationRecipient, RecipientType } from '../entities/communication-recipient.entity';
import { CommunicationRead } from '../entities/communication-read.entity';
import { CommunicationFilterDto } from '../dto/communication-filter.dto';

export interface CommunicationRecipientView {
  recipientType: RecipientType;
  targetId: string | null;
  /** Texto legible: "Toda la institución", "Estudiantes", "10-1 · 10° Año"… */
  label: string;
}

const ROLE_AUDIENCE_LABELS: Record<string, string> = {
  Administrador: 'Administración',
  Director: 'Dirección',
  Orientador: 'Orientación',
  Docente: 'Docentes',
  Estudiante: 'Estudiantes',
  Encargado: 'Padres y encargados',
};

function baseRecipientLabel(recipientType: RecipientType, targetId: string | null): string {
  switch (recipientType) {
    case RecipientType.ALL:
      return 'Toda la institución';
    case RecipientType.ROLE:
      return ROLE_AUDIENCE_LABELS[targetId ?? ''] ?? targetId ?? 'Rol';
    case RecipientType.GROUP:
      return `Sección ${targetId ?? ''}`.trim();
    case RecipientType.USER:
    default:
      return 'Destinatario individual';
  }
}

/**
 * Representación pública de un comunicado. Nunca expone la entidad `User`
 * del autor (contiene `password_hash`), solo nombre y correo.
 */
export interface CommunicationView {
  id: string;
  title: string;
  content: string;
  priority: CommunicationPriority;
  status: CommunicationStatus;
  requiresAcknowledgment: boolean;
  publishDate: Date | null;
  expirationDate: Date | null;
  authorId: number;
  authorName: string;
  authorEmail: string;
  createdAt: Date;
  updatedAt: Date;
  recipients: CommunicationRecipientView[];
}

export interface FeedCommunicationItem extends CommunicationView {
  isRead: boolean;
  readAt: Date | null;
  isAcknowledged: boolean;
  acknowledgedAt: Date | null;
}

export interface AdminCommunicationItem extends CommunicationView {
  totalReads: number;
  totalAcknowledged: number;
  totalEstimatedAudience: number;
  readRate: number;
}

export interface FeedTargetContext {
  userId: number;
  roleNames: string[];
  groupIds: number[];
}

const PRIORITY_RANK_SQL = `CASE c.priority WHEN '${CommunicationPriority.URGENT}' THEN 0 WHEN '${CommunicationPriority.IMPORTANT}' THEN 1 ELSE 2 END`;

export function toCommunicationView(entity: Communication): CommunicationView {
  const author = entity.author;
  return {
    id: entity.id,
    title: entity.title,
    content: entity.content,
    priority: entity.priority,
    status: entity.status,
    requiresAcknowledgment: Boolean(entity.requiresAcknowledgment),
    publishDate: entity.publishDate,
    expirationDate: entity.expirationDate,
    authorId: entity.authorId,
    authorName: author
      ? `${author.name ?? ''} ${author.first_lastname ?? ''}`.trim() || 'Personal institucional'
      : 'Personal institucional',
    authorEmail: author?.email ?? '',
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    recipients: (entity.recipients ?? []).map((r) => ({
      recipientType: r.recipientType,
      targetId: r.targetId,
      label: baseRecipientLabel(r.recipientType, r.targetId),
    })),
  };
}

@Injectable()
export class CommunicationsRepository {
  constructor(
    @InjectRepository(Communication)
    private readonly commRepo: Repository<Communication>,
    @InjectRepository(CommunicationRecipient)
    private readonly recipientRepo: Repository<CommunicationRecipient>,
    @InjectRepository(CommunicationRead)
    private readonly readRepo: Repository<CommunicationRead>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async create(data: Partial<Communication>): Promise<Communication> {
    const item = this.commRepo.create(data);
    return this.commRepo.save(item);
  }

  async save(communication: Communication): Promise<Communication> {
    return this.commRepo.save(communication);
  }

  async findById(id: string): Promise<Communication | null> {
    return this.commRepo.findOne({
      where: { id },
      relations: { author: true, recipients: true },
    });
  }

  async delete(id: string): Promise<void> {
    await this.commRepo.delete(id);
  }

  async replaceRecipients(
    communicationId: string,
    recipients: { recipientType: RecipientType; targetId?: string | null }[],
  ): Promise<void> {
    await this.recipientRepo.delete({ communicationId });
    if (recipients.length > 0) {
      const entities = recipients.map((r) =>
        this.recipientRepo.create({
          communicationId,
          recipientType: r.recipientType,
          targetId: r.recipientType === RecipientType.ALL ? null : (r.targetId ?? null),
        }),
      );
      await this.recipientRepo.save(entities);
    }
  }

  /**
   * Comunicados publicados, vigentes y dirigidos al usuario (por ALL, rol,
   * grupo o usuario). Incluye el estado de lectura propio vía LEFT JOIN 1:1
   * (uq_comm_user_read garantiza una fila por usuario).
   */
  private buildFeedBase(ctx: FeedTargetContext): SelectQueryBuilder<Communication> {
    const now = new Date();
    const qb = this.commRepo
      .createQueryBuilder('c')
      .leftJoin(
        'communication_reads',
        'cr',
        'cr.communication_id = c.id AND cr.user_id = :feedUserId',
        { feedUserId: ctx.userId },
      )
      .where('c.status = :feedStatus', { feedStatus: CommunicationStatus.PUBLISHED })
      .andWhere('(c.publish_date IS NULL OR c.publish_date <= :feedNow)', { feedNow: now })
      .andWhere('(c.expiration_date IS NULL OR c.expiration_date >= :feedNow)', { feedNow: now });

    const groupClause =
      ctx.groupIds.length > 0
        ? `OR (r.recipient_type = 'GROUP' AND r.target_id IN (:...feedGroupIds))`
        : '';

    qb.andWhere(
      `EXISTS (
        SELECT 1 FROM communication_recipients r
        WHERE r.communication_id = c.id
        AND (
          r.recipient_type = 'ALL'
          OR (r.recipient_type = 'ROLE' AND r.target_id IN (:...feedRoleNames))
          ${groupClause}
          OR (r.recipient_type = 'USER' AND r.target_id = :feedUserIdStr)
        )
      )`,
      {
        feedRoleNames: ctx.roleNames.length > 0 ? ctx.roleNames : ['__NONE__'],
        feedGroupIds: ctx.groupIds.map(String),
        feedUserIdStr: String(ctx.userId),
      },
    );

    return qb;
  }

  async findFeedForUser(
    ctx: FeedTargetContext,
    filter: CommunicationFilterDto,
  ): Promise<{ items: FeedCommunicationItem[]; total: number; unreadCount: number }> {
    const unreadCount = await this.buildFeedBase(ctx).andWhere('cr.read_at IS NULL').getCount();

    const qb = this.buildFeedBase(ctx);

    if (filter.search?.trim()) {
      qb.andWhere('(c.title LIKE :search OR c.content LIKE :search)', {
        search: `%${filter.search.trim()}%`,
      });
    }

    if (filter.unreadOnly) {
      qb.andWhere('cr.read_at IS NULL');
    }

    if (filter.urgentOnly) {
      qb.andWhere('c.priority = :priority', { priority: CommunicationPriority.URGENT });
    } else if (filter.priority) {
      qb.andWhere('c.priority = :priority', { priority: filter.priority });
    }

    const total = await qb.getCount();

    const page = filter.page && filter.page > 0 ? filter.page : 1;
    const limit = filter.limit && filter.limit > 0 ? Math.min(filter.limit, 100) : 20;

    // Paso 1: ids ordenados (urgentes primero, luego más recientes). Sin joins
    // 1:N, por lo que LIMIT/OFFSET son exactos.
    const idRows: { id: string }[] = await qb
      .select('c.id', 'id')
      .addSelect(PRIORITY_RANK_SQL, 'priority_rank')
      .addSelect('COALESCE(c.publish_date, c.created_at)', 'sort_date')
      .orderBy('priority_rank', 'ASC')
      .addOrderBy('sort_date', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany();

    const ids = idRows.map((r) => r.id);
    if (ids.length === 0) {
      return { items: [], total, unreadCount };
    }

    // Paso 2: entidades completas y lecturas propias en dos consultas (sin N+1).
    const [entities, reads] = await Promise.all([
      this.commRepo.find({
        where: { id: In(ids) },
        relations: { author: true, recipients: true },
      }),
      this.readRepo.find({ where: { communicationId: In(ids), userId: ctx.userId } }),
    ]);

    const entityMap = new Map(entities.map((e) => [e.id, e]));
    const readMap = new Map(reads.map((r) => [r.communicationId, r]));

    const items: FeedCommunicationItem[] = [];
    for (const id of ids) {
      const entity = entityMap.get(id);
      if (!entity) continue;
      const read = readMap.get(id);
      items.push({
        ...toCommunicationView(entity),
        isRead: Boolean(read?.readAt),
        readAt: read?.readAt ?? null,
        isAcknowledged: Boolean(read?.acknowledgedAt),
        acknowledgedAt: read?.acknowledgedAt ?? null,
      });
    }

    await this.attachGroupLabels(items);
    return { items, total, unreadCount };
  }

  async findAdminList(
    filter: CommunicationFilterDto,
    authorIdLimit?: number,
  ): Promise<{ items: AdminCommunicationItem[]; total: number; countsByStatus: Record<CommunicationStatus, number> }> {
    const applyCommonFilters = (qb: SelectQueryBuilder<Communication>) => {
      if (authorIdLimit) {
        qb.andWhere('c.author_id = :authorIdLimit', { authorIdLimit });
      }
      if (filter.priority) {
        qb.andWhere('c.priority = :priority', { priority: filter.priority });
      }
      if (filter.search?.trim()) {
        qb.andWhere('(c.title LIKE :search OR c.content LIKE :search)', {
          search: `%${filter.search.trim()}%`,
        });
      }
      return qb;
    };

    // Conteo por estado (para las pestañas), independiente del filtro de estado.
    const countRows: { status: CommunicationStatus; total: string }[] = await applyCommonFilters(
      this.commRepo.createQueryBuilder('c'),
    )
      .select('c.status', 'status')
      .addSelect('COUNT(*)', 'total')
      .groupBy('c.status')
      .getRawMany();

    const countsByStatus: Record<CommunicationStatus, number> = {
      [CommunicationStatus.DRAFT]: 0,
      [CommunicationStatus.PUBLISHED]: 0,
      [CommunicationStatus.ARCHIVED]: 0,
    };
    for (const row of countRows) {
      countsByStatus[row.status] = Number(row.total || 0);
    }

    const qb = applyCommonFilters(
      this.commRepo
        .createQueryBuilder('c')
        .leftJoinAndSelect('c.author', 'author')
        .leftJoinAndSelect('c.recipients', 'recipients'),
    );

    if (filter.status) {
      qb.andWhere('c.status = :status', { status: filter.status });
    }

    qb.orderBy('c.createdAt', 'DESC');

    const page = filter.page && filter.page > 0 ? filter.page : 1;
    const limit = filter.limit && filter.limit > 0 ? Math.min(filter.limit, 100) : 20;

    const [entities, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    if (entities.length === 0) {
      return { items: [], total, countsByStatus };
    }

    const ids = entities.map((e) => e.id);

    const statsRaw: { comm_id: string; total_reads: string; total_ack: string }[] =
      await this.dataSource.query(
        `SELECT
          cr.communication_id AS comm_id,
          COUNT(DISTINCT cr.user_id) AS total_reads,
          COUNT(DISTINCT CASE WHEN cr.acknowledged_at IS NOT NULL THEN cr.user_id END) AS total_ack
        FROM communication_reads cr
        WHERE cr.communication_id IN (?)
        GROUP BY cr.communication_id`,
        [ids],
      );

    const statsMap = new Map<string, { totalReads: number; totalAcknowledged: number }>();
    for (const row of statsRaw) {
      statsMap.set(row.comm_id, {
        totalReads: Number(row.total_reads || 0),
        totalAcknowledged: Number(row.total_ack || 0),
      });
    }

    const audiences = await Promise.all(
      entities.map((e) => this.estimateAudience(e.recipients ?? [])),
    );

    const items: AdminCommunicationItem[] = entities.map((e, idx) => {
      const stats = statsMap.get(e.id) ?? { totalReads: 0, totalAcknowledged: 0 };
      const totalEstimatedAudience = audiences[idx];
      return {
        ...toCommunicationView(e),
        totalReads: stats.totalReads,
        totalAcknowledged: stats.totalAcknowledged,
        totalEstimatedAudience,
        readRate: percentage(stats.totalReads, totalEstimatedAudience),
      };
    });

    await this.attachGroupLabels(items);
    return { items, total, countsByStatus };
  }

  /** Reemplaza "Sección N" por el nombre real del grupo (una sola consulta). */
  async attachGroupLabels<T extends CommunicationView>(views: T[]): Promise<T[]> {
    const groupIds = new Set<number>();
    for (const v of views) {
      for (const r of v.recipients) {
        if (r.recipientType === RecipientType.GROUP && r.targetId) {
          const n = Number(r.targetId);
          if (Number.isFinite(n)) groupIds.add(n);
        }
      }
    }
    if (groupIds.size === 0) return views;

    const rows: { id: number; name: string; section_name: string | null }[] =
      await this.dataSource.query(
        `SELECT g.id_groups AS id, g.name, s.name AS section_name
         FROM \`groups\` g
         LEFT JOIN sections s ON s.id_sections = g.id_sections
         WHERE g.id_groups IN (?)`,
        [Array.from(groupIds)],
      );
    const names = new Map(
      rows.map((row) => [
        String(row.id),
        row.section_name && row.section_name !== row.name
          ? `${row.name} · ${row.section_name}`
          : row.name,
      ]),
    );

    for (const v of views) {
      for (const r of v.recipients) {
        if (r.recipientType === RecipientType.GROUP && r.targetId && names.has(r.targetId)) {
          r.label = names.get(r.targetId) as string;
        }
      }
    }
    return views;
  }

  /**
   * Cantidad de usuarios activos alcanzados por la segmentación. Replica las
   * mismas reglas que el feed: rol, matrícula en grupo, docente asignado al
   * grupo o encargado de un estudiante matriculado.
   */
  async estimateAudience(
    recipients: { recipientType: RecipientType; targetId: string | null }[],
  ): Promise<number> {
    if (recipients.length === 0 || recipients.some((r) => r.recipientType === RecipientType.ALL)) {
      const [row] = await this.dataSource.query(
        "SELECT COUNT(*) AS total FROM users WHERE status = 'ACTIVE'",
      );
      return Number(row?.total ?? 0);
    }

    const roleNames = recipients
      .filter((r) => r.recipientType === RecipientType.ROLE && r.targetId)
      .map((r) => r.targetId as string);
    const groupIds = recipients
      .filter((r) => r.recipientType === RecipientType.GROUP && r.targetId)
      .map((r) => Number(r.targetId))
      .filter((n) => Number.isFinite(n));
    const userIds = recipients
      .filter((r) => r.recipientType === RecipientType.USER && r.targetId)
      .map((r) => Number(r.targetId))
      .filter((n) => Number.isFinite(n));

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (roleNames.length > 0) {
      conditions.push(
        `EXISTS (SELECT 1 FROM user_roles ur INNER JOIN roles ro ON ro.id_roles = ur.id_roles
                 WHERE ur.id_users = u.id_users AND ro.name IN (?))`,
      );
      params.push(roleNames);
    }
    if (groupIds.length > 0) {
      conditions.push(
        `EXISTS (SELECT 1 FROM group_enrollments ge WHERE ge.id_users = u.id_users AND ge.id_groups IN (?))`,
        `EXISTS (SELECT 1 FROM teaching_assignments ta WHERE ta.id_users = u.id_users AND ta.id_groups IN (?))`,
        `EXISTS (SELECT 1 FROM guardian_student_links gsl
                 INNER JOIN group_enrollments ge2 ON ge2.id_users = gsl.id_users_student
                 WHERE gsl.id_users_guardian = u.id_users AND ge2.id_groups IN (?))`,
      );
      params.push(groupIds, groupIds, groupIds);
    }
    if (userIds.length > 0) {
      conditions.push('u.id_users IN (?)');
      params.push(userIds);
    }

    if (conditions.length === 0) return 0;

    const [row] = await this.dataSource.query(
      `SELECT COUNT(DISTINCT u.id_users) AS total
       FROM users u
       WHERE u.status = 'ACTIVE' AND (${conditions.join(' OR ')})`,
      params,
    );
    return Number(row?.total ?? 0);
  }

  async getDetailedStats(communicationId: string) {
    const communication = await this.findById(communicationId);
    if (!communication) return null;

    const totalAudience = await this.estimateAudience(communication.recipients ?? []);

    const readers: {
      user_id: number;
      name: string;
      first_lastname: string;
      second_lastname: string | null;
      email: string;
      read_at: Date;
      acknowledged_at: Date | null;
    }[] = await this.dataSource.query(
      `SELECT
        u.id_users AS user_id,
        u.name,
        u.first_lastname,
        u.second_lastname,
        u.email,
        cr.read_at,
        cr.acknowledged_at
      FROM communication_reads cr
      INNER JOIN users u ON u.id_users = cr.user_id
      WHERE cr.communication_id = ?
      ORDER BY cr.read_at DESC`,
      [communicationId],
    );

    const totalReads = readers.length;
    const totalAcknowledged = readers.filter((r) => r.acknowledged_at !== null).length;

    return {
      communicationId,
      title: communication.title,
      priority: communication.priority,
      status: communication.status,
      requiresAcknowledgment: Boolean(communication.requiresAcknowledgment),
      totalAudience,
      totalReads,
      totalAcknowledged,
      readRate: percentage(totalReads, totalAudience),
      ackRate: percentage(totalAcknowledged, totalReads),
      readers: readers.map((r) => ({
        userId: r.user_id,
        fullName: `${r.name ?? ''} ${r.first_lastname ?? ''} ${r.second_lastname ?? ''}`
          .replace(/\s+/g, ' ')
          .trim(),
        email: r.email,
        readAt: r.read_at,
        acknowledgedAt: r.acknowledged_at,
      })),
    };
  }
}

function percentage(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.min(100, Math.round((part / whole) * 10000) / 100);
}
