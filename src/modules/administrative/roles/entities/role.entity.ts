import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RoleStatus } from '../../../../common/enums/role-status.enum';
import { PermissionEntity } from '../../permissions/entities/permission.entity';
import { UserRoleEntity } from '../../users/entities/user-role.entity';
import { RolePermissionEntity } from './role-permission.entity';

@Entity({ name: 'roles' })
export class RoleEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id_roles' })
  id!: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'is_system_role', type: 'boolean', default: false })
  isSystemRole!: boolean;

  @Column({
    type: 'enum',
    enum: RoleStatus,
    default: RoleStatus.ACTIVE,
  })
  status!: RoleStatus;

  @OneToMany(() => RolePermissionEntity, (row) => row.role, { cascade: true })
  rolePermissions?: RolePermissionEntity[];

  @OneToMany(() => UserRoleEntity, (row) => row.role)
  userRoles?: UserRoleEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;

  get permissions(): PermissionEntity[] {
    return (this.rolePermissions ?? [])
      .map((row) => row.permission)
      .filter((permission): permission is PermissionEntity => Boolean(permission));
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description ?? null,
      isSystemRole: this.isSystemRole,
      status: this.status,
      permissions: this.permissions,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
