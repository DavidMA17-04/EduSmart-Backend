import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { PermissionEntity } from '../../permissions/entities/permission.entity';
import { RoleEntity } from './role.entity';

@Entity({ name: 'role_permissions' })
export class RolePermissionEntity {
  @PrimaryColumn({ name: 'id_roles', type: 'int' })
  roleId!: number;

  @PrimaryColumn({ name: 'id_permissions', type: 'int' })
  permissionId!: number;

  @ManyToOne(() => RoleEntity, (role) => role.rolePermissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'id_roles' })
  role!: RoleEntity;

  @ManyToOne(() => PermissionEntity, (permission) => permission.rolePermissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'id_permissions' })
  permission!: PermissionEntity;
}
