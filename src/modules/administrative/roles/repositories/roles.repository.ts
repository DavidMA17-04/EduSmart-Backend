import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoleStatus } from '../../../../common/enums/role-status.enum';
import { RoleEntity } from '../entities/role.entity';
import { PermissionEntity } from '../../permissions/entities/permission.entity';

@Injectable()
export class RolesRepository {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly repository: Repository<RoleEntity>,
  ) {}

  create(data: Partial<RoleEntity>): RoleEntity {
    return this.repository.create(data);
  }

  async save(entity: RoleEntity): Promise<RoleEntity> {
    return this.repository.save(entity);
  }

  async findAll(): Promise<RoleEntity[]> {
    return this.repository.find({
      relations: { permissions: true },
      order: { name: 'ASC' },
    });
  }

  async findById(id: string): Promise<RoleEntity | null> {
    return this.repository.findOne({
      where: { id },
      relations: { permissions: true },
    });
  }

  async findByName(name: string): Promise<RoleEntity | null> {
    return this.repository.findOne({ where: { name } });
  }

  async deactivate(entity: RoleEntity): Promise<RoleEntity> {
    entity.status = RoleStatus.INACTIVE;
    return this.repository.save(entity);
  }

  async setPermissions(
    role: RoleEntity,
    permissions: PermissionEntity[],
  ): Promise<RoleEntity> {
    role.permissions = permissions;
    return this.repository.save(role);
  }
}
