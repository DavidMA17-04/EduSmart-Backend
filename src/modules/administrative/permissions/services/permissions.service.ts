import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PermissionAction } from '../../../../common/enums/permission-action.enum';
import { PermissionModule } from '../../../../common/enums/permission-module.enum';
import { CreatePermissionDto } from '../dto/create-permission.dto';
import { UpdatePermissionDto } from '../dto/update-permission.dto';
import { PermissionEntity } from '../entities/permission.entity';
import { PermissionsRepository } from '../repositories/permissions.repository';

@Injectable()
export class PermissionsService {
  constructor(private readonly repository: PermissionsRepository) {}

  async create(dto: CreatePermissionDto): Promise<PermissionEntity> {
    const code = dto.code ?? this.buildCode(dto.module, dto.action);

    await this.ensureUniqueCode(code);
    await this.ensureUniqueModuleAction(dto.module, dto.action);

    const permission = this.repository.create({
      code,
      module: dto.module,
      action: dto.action,
      description: dto.description ?? null,
    });

    return this.repository.save(permission);
  }

  async findAll(): Promise<PermissionEntity[]> {
    return this.repository.findAll();
  }

  async findOne(id: number): Promise<PermissionEntity> {
    const permission = await this.repository.findById(id);
    if (!permission) {
      throw new NotFoundException(`Permission ${id} not found`);
    }
    return permission;
  }

  async update(
    id: number,
    dto: UpdatePermissionDto,
  ): Promise<PermissionEntity> {
    const permission = await this.findOne(id);

    const nextModule = dto.module ?? permission.module;
    const nextAction = dto.action ?? permission.action;
    const nextCode =
      dto.code ??
      (dto.module || dto.action
        ? this.buildCode(nextModule, nextAction)
        : permission.code);

    if (nextCode !== permission.code) {
      await this.ensureUniqueCode(nextCode, id);
    }

    if (
      nextModule !== permission.module ||
      nextAction !== permission.action
    ) {
      await this.ensureUniqueModuleAction(nextModule, nextAction, id);
    }

    permission.code = nextCode;
    permission.module = nextModule;
    permission.action = nextAction;
    if (dto.description !== undefined) {
      permission.description = dto.description ?? null;
    }

    return this.repository.save(permission);
  }

  async remove(id: number): Promise<void> {
    const permission = await this.findOne(id);
    const usage = await this.repository.countRolesUsingPermission(id);

    if (usage > 0) {
      throw new ConflictException(
        `Permission ${id} is assigned to ${usage} role(s) and cannot be deleted`,
      );
    }

    await this.repository.remove(permission);
  }

  async findByIdsOrFail(ids: number[]): Promise<PermissionEntity[]> {
    const uniqueIds = [...new Set(ids)];
    const permissions = await this.repository.findByIds(uniqueIds);

    if (permissions.length !== uniqueIds.length) {
      const found = new Set(permissions.map((item) => item.id));
      const missing = uniqueIds.filter((id) => !found.has(id));
      throw new NotFoundException(
        `Permissions not found: ${missing.join(', ')}`,
      );
    }

    return permissions;
  }

  private buildCode(
    module: PermissionModule,
    action: PermissionAction,
  ): string {
    return `${module.toLowerCase()}.${action.toLowerCase()}`;
  }

  private async ensureUniqueCode(
    code: string,
    excludeId?: number,
  ): Promise<void> {
    const existing = await this.repository.findByCode(code);
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Permission code "${code}" already exists`);
    }
  }

  private async ensureUniqueModuleAction(
    module: PermissionModule,
    action: PermissionAction,
    excludeId?: number,
  ): Promise<void> {
    const existing = await this.repository.findByModuleAndAction(
      module,
      action,
    );
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `Permission for module "${module}" and action "${action}" already exists`,
      );
    }
  }
}
