import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DEFAULT_ROLE_PERMISSIONS_ALL,
  getDefaultPermissionTemplate,
} from '../../../../common/constants/default-role-permissions.constant';
import { INSTITUTIONAL_ROLE_ADMIN } from '../../../../common/constants/institutional-roles.constant';
import { PROTECTED_ADMIN_PERMISSIONS } from '../../../../common/constants/protected-admin-permissions.constant';
import { RoleStatus } from '../../../../common/enums/role-status.enum';
import { PermissionsService } from '../../permissions/services/permissions.service';
import { AssignPermissionsDto } from '../dto/assign-permissions.dto';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { RoleEntity } from '../entities/role.entity';
import { RolesRepository } from '../repositories/roles.repository';

@Injectable()
export class RolesService {
  constructor(
    private readonly repository: RolesRepository,
    private readonly permissionsService: PermissionsService,
  ) {}

  async create(dto: CreateRoleDto): Promise<RoleEntity> {
    await this.ensureUniqueName(dto.name);

    const permissions = dto.permissionIds?.length
      ? await this.permissionsService.findByIdsOrFail(dto.permissionIds)
      : [];

    const role = await this.repository.save(
      this.repository.create({
        name: dto.name,
        description: dto.description ?? null,
        isSystemRole: false,
        status: dto.status ?? RoleStatus.ACTIVE,
      }),
    );

    if (permissions.length) {
      return this.repository.setPermissions(role, permissions);
    }

    return (await this.repository.findById(role.id)) ?? role;
  }

  async findAll(): Promise<RoleEntity[]> {
    return this.repository.findAll();
  }

  async findOne(id: number): Promise<RoleEntity> {
    const role = await this.repository.findById(id);
    if (!role) {
      throw new NotFoundException(`Role ${id} not found`);
    }
    return role;
  }

  async update(id: number, dto: UpdateRoleDto): Promise<RoleEntity> {
    const role = await this.findOne(id);

    if (dto.name && dto.name !== role.name) {
      await this.ensureUniqueName(dto.name, id);
      role.name = dto.name;
    }

    if (dto.description !== undefined) {
      role.description = dto.description ?? null;
    }

    if (dto.status !== undefined) {
      role.status = dto.status;
    }

    await this.repository.save(role);

    if (dto.permissionIds !== undefined) {
      const permissions = await this.permissionsService.findByIdsOrFail(dto.permissionIds);
      this.assertAdminProtectedPermissions(role, permissions.map((item) => item.code));
      return this.repository.setPermissions(role, permissions);
    }

    return this.findOne(id);
  }

  async remove(id: number): Promise<RoleEntity> {
    const role = await this.findOne(id);
    return this.repository.deactivate(role);
  }

  async assignPermissions(id: number, dto: AssignPermissionsDto): Promise<RoleEntity> {
    const role = await this.findOne(id);
    const permissions = await this.permissionsService.findByIdsOrFail(dto.permissionIds);
    this.assertAdminProtectedPermissions(role, permissions.map((item) => item.code));
    return this.repository.setPermissions(role, permissions);
  }

  async resetToDefaults(id: number): Promise<RoleEntity> {
    const role = await this.findOne(id);
    const template = getDefaultPermissionTemplate(role.name);

    if (!template) {
      throw new BadRequestException(
        `El rol "${role.name}" no tiene plantilla de permisos predeterminados.`,
      );
    }

    const permissions =
      template === DEFAULT_ROLE_PERMISSIONS_ALL
        ? await this.permissionsService.findAll()
        : await this.permissionsService.findByCodesOrFail([...template]);

    this.assertAdminProtectedPermissions(
      role,
      permissions.map((item) => item.code),
    );

    return this.repository.setPermissions(role, permissions);
  }

  private assertAdminProtectedPermissions(role: RoleEntity, assignedCodes: string[]): void {
    if (role.name !== INSTITUTIONAL_ROLE_ADMIN) {
      return;
    }

    const assigned = new Set(assignedCodes);
    const missing = PROTECTED_ADMIN_PERMISSIONS.filter((code) => !assigned.has(code));

    if (missing.length > 0) {
      throw new ForbiddenException(
        `No se pueden revocar permisos críticos del Administrador: ${missing.join(', ')}`,
      );
    }
  }

  private async ensureUniqueName(name: string, excludeId?: number): Promise<void> {
    const existing = await this.repository.findByName(name);
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Role name "${name}" already exists`);
    }
  }
}
