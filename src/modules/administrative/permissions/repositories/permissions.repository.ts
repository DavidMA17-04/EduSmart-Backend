import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PermissionAction } from '../../../../common/enums/permission-action.enum';
import { PermissionModule } from '../../../../common/enums/permission-module.enum';
import { PermissionEntity } from '../entities/permission.entity';

@Injectable()
export class PermissionsRepository {
  constructor(
    @InjectRepository(PermissionEntity)
    private readonly repository: Repository<PermissionEntity>,
  ) {}

  create(data: Partial<PermissionEntity>): PermissionEntity {
    return this.repository.create(data);
  }

  async save(entity: PermissionEntity): Promise<PermissionEntity> {
    return this.repository.save(entity);
  }

  async findAll(): Promise<PermissionEntity[]> {
    return this.repository.find({
      order: { module: 'ASC', action: 'ASC' },
    });
  }

  async findById(id: string): Promise<PermissionEntity | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByIds(ids: string[]): Promise<PermissionEntity[]> {
    if (ids.length === 0) {
      return [];
    }

    return this.repository.find({
      where: { id: In(ids) },
    });
  }

  async findByCode(code: string): Promise<PermissionEntity | null> {
    return this.repository.findOne({ where: { code } });
  }

  async findByModuleAndAction(
    module: PermissionModule,
    action: PermissionAction,
  ): Promise<PermissionEntity | null> {
    return this.repository.findOne({ where: { module, action } });
  }

  async remove(entity: PermissionEntity): Promise<PermissionEntity> {
    return this.repository.remove(entity);
  }

  async countRolesUsingPermission(permissionId: string): Promise<number> {
    return this.repository
      .createQueryBuilder('permission')
      .innerJoin('permission.roles', 'role')
      .where('permission.id = :permissionId', { permissionId })
      .getCount();
  }
}
