import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PermissionAction } from '../../../../common/enums/permission-action.enum';
import { PermissionModule } from '../../../../common/enums/permission-module.enum';
import { RolePermissionEntity } from '../../roles/entities/role-permission.entity';

@Entity({ name: 'permissions' })
@Index(['module', 'action'], { unique: true })
export class PermissionEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id_permissions' })
  id!: number;

  @Column({ type: 'varchar', length: 120, unique: true })
  code!: string;

  @Column({ type: 'enum', enum: PermissionModule })
  module!: PermissionModule;

  @Column({ type: 'enum', enum: PermissionAction })
  action!: PermissionAction;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string | null;

  @OneToMany(() => RolePermissionEntity, (row) => row.permission)
  rolePermissions?: RolePermissionEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}
