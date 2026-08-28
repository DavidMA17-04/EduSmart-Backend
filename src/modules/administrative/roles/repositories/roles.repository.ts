import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoleStatus } from '../../../../common/enums/role-status.enum';
import { PermissionEntity } from '../../permissions/entities/permission.entity';
import { RoleEntity } from '../entities/role.entity';
import { RolePermissionEntity } from '../entities/role-permission.entity';

const ROLE_RELATIONS = {
  rolePermissions: { permission: true },
} as const;

@Injectable()
export class RolesRepository {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly repository: Repository<RoleEntity>,
    @InjectRepository(RolePermissionEntity)
    private readonly rolePermissions: Repository<RolePermissionEntity>,
  ) {}

  create(data: Partial<RoleEntity>): RoleEntity {
    return this.repository.create(data);
  }

  async save(entity: RoleEntity): Promise<RoleEntity> {
    return this.repository.save(entity);
  }

  async findAll(): Promise<RoleEntity[]> {
    return this.repository.find({
      relations: ROLE_RELATIONS,
      order: { name: 'ASC' },
    });
  }

  async findById(id: number): Promise<RoleEntity | null> {
    return this.repository.findOne({
      where: { id },
      relations: ROLE_RELATIONS,
    });
  }

  async findByName(name: string): Promise<RoleEntity | null> {
    return this.repository.findOne({
      where: { name },
      relations: ROLE_RELATIONS,
    });
  }

  async deactivate(entity: RoleEntity): Promise<RoleEntity> {
    entity.status = RoleStatus.INACTIVE;
    return this.repository.save(entity);
  }

  async setPermissions(
    role: RoleEntity,
    permissions: PermissionEntity[],
  ): Promise<RoleEntity> {
    await this.setPermissionIds(
      role.id,
      permissions.map((permission) => permission.id),
    );
    return (await this.findById(role.id)) ?? role;
  }

  async setPermissionIds(roleId: number, permissionIds: number[]): Promise<void> {
    await this.rolePermissions.delete({ roleId });
    if (!permissionIds.length) return;
    await this.rolePermissions.save(
      permissionIds.map((permissionId) =>
        this.rolePermissions.create({ roleId, permissionId }),
      ),
    );
  }
}
