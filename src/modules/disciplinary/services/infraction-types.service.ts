import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../administrative/users/entities/audit-log.entity';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import {
  getSeverityRule,
  INFRACTION_SEVERITY_RULES,
  InfractionSeverity,
  InfractionSeverityRule,
} from '../constants/infraction-severity.constant';
import {
  CreateInfractionTypeDto,
  ListInfractionTypesQueryDto,
  UpdateInfractionTypeDto,
} from '../dto/infraction-type.dto';
import { InfractionTypeEntity } from '../entities/infraction-type.entity';

export interface InfractionTypeView {
  id: number;
  name: string;
  description: string | null;
  severity: InfractionSeverity;
  severityLabel: string;
  deduction: number;
  track: InfractionSeverityRule['track'];
  legalReference: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AUDIT_ENTITY = 'disciplinary_infraction_types';

@Injectable()
export class InfractionTypesService {
  constructor(
    @InjectRepository(InfractionTypeEntity)
    private readonly repository: Repository<InfractionTypeEntity>,
    @InjectRepository(AuditLog)
    private readonly auditLogs: Repository<AuditLog>,
  ) {}

  listSeverityRules(): readonly InfractionSeverityRule[] {
    return INFRACTION_SEVERITY_RULES;
  }

  async findAll(query: ListInfractionTypesQueryDto): Promise<InfractionTypeView[]> {
    const qb = this.repository.createQueryBuilder('t');
    if (query.severity) {
      qb.andWhere('t.severity = :severity', { severity: query.severity });
    }
    if (query.active !== undefined) {
      qb.andWhere('t.is_active = :active', { active: query.active ? 1 : 0 });
    }
    const severityOrder = INFRACTION_SEVERITY_RULES.map((r) => `'${r.severity}'`).join(', ');
    qb.orderBy(`FIELD(t.severity, ${severityOrder})`, 'ASC').addOrderBy('t.name', 'ASC');
    const rows = await qb.getMany();
    return rows.map((row) => this.toView(row));
  }

  async findOne(id: number): Promise<InfractionTypeView> {
    return this.toView(await this.getEntity(id));
  }

  async create(dto: CreateInfractionTypeDto, actor: AuthenticatedUser): Promise<InfractionTypeView> {
    await this.ensureUnique(dto.name, dto.severity);
    const saved = await this.repository.save(
      this.repository.create({
        name: dto.name,
        description: dto.description || null,
        severity: dto.severity,
        legalReference: dto.legalReference || null,
        isActive: true,
      }),
    );
    await this.audit(actor, 'INFRACTION_TYPE_CREATE', saved.id, null, saved);
    return this.toView(saved);
  }

  async update(
    id: number,
    dto: UpdateInfractionTypeDto,
    actor: AuthenticatedUser,
  ): Promise<InfractionTypeView> {
    const entity = await this.getEntity(id);
    const before = { ...entity };

    const nextName = dto.name ?? entity.name;
    const nextSeverity = dto.severity ?? entity.severity;
    const nextActive = dto.isActive ?? entity.isActive;
    if (
      nextActive &&
      (nextName.toLowerCase() !== entity.name.toLowerCase() ||
        nextSeverity !== entity.severity ||
        !entity.isActive)
    ) {
      await this.ensureUnique(nextName, nextSeverity, id);
    }

    entity.name = nextName;
    entity.severity = nextSeverity;
    entity.isActive = nextActive;
    if (dto.description !== undefined) entity.description = dto.description || null;
    if (dto.legalReference !== undefined) entity.legalReference = dto.legalReference || null;

    const saved = await this.repository.save(entity);
    await this.audit(actor, 'INFRACTION_TYPE_UPDATE', id, before, saved);
    return this.toView(saved);
  }

  async deactivate(id: number, actor: AuthenticatedUser): Promise<InfractionTypeView> {
    const entity = await this.getEntity(id);
    if (!entity.isActive) {
      return this.toView(entity);
    }
    const before = { ...entity };
    entity.isActive = false;
    const saved = await this.repository.save(entity);
    await this.audit(actor, 'INFRACTION_TYPE_DEACTIVATE', id, before, saved);
    return this.toView(saved);
  }

  private async getEntity(id: number): Promise<InfractionTypeEntity> {
    const entity = await this.repository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException({
        code: 'INFRACTION_TYPE_NOT_FOUND',
        message: `Tipo de falta ${id} no encontrado`,
      });
    }
    return entity;
  }

  private async ensureUnique(
    name: string,
    severity: InfractionSeverity,
    excludeId?: number,
  ): Promise<void> {
    const qb = this.repository
      .createQueryBuilder('t')
      .where('LOWER(t.name) = LOWER(:name)', { name: name.trim() })
      .andWhere('t.severity = :severity', { severity })
      .andWhere('t.is_active = 1');
    if (excludeId !== undefined) {
      qb.andWhere('t.id_disciplinary_infraction_types <> :excludeId', { excludeId });
    }
    if (await qb.getExists()) {
      throw new ConflictException({
        code: 'INFRACTION_TYPE_DUPLICATE',
        message: 'Ya existe un tipo de falta activo con ese nombre y gravedad',
      });
    }
  }

  private async audit(
    actor: AuthenticatedUser,
    action: string,
    entityId: number,
    before: object | null,
    after: object | null,
  ): Promise<void> {
    await this.auditLogs.save(
      this.auditLogs.create({
        actorId: actor.id ?? null,
        action,
        entity: AUDIT_ENTITY,
        entityId: String(entityId),
        before: before as Record<string, unknown> | null,
        after: after as Record<string, unknown> | null,
      }),
    );
  }

  private toView(row: InfractionTypeEntity): InfractionTypeView {
    const rule = getSeverityRule(row.severity);
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? null,
      severity: row.severity,
      severityLabel: rule.label,
      deduction: rule.deduction,
      track: rule.track,
      legalReference: row.legalReference ?? null,
      isActive: Boolean(row.isActive),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
