import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PermissionAction } from '../../../../common/enums/permission-action.enum';
import { PermissionModule } from '../../../../common/enums/permission-module.enum';
import { RoleEntity } from '../../roles/entities/role.entity';

@Entity({ name: 'permissions' })
@Index(['module', 'action'], { unique: true })
export class PermissionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Código estable para guards, ej. `attendance.view` */
  @Column({ type: 'varchar', length: 120, unique: true })
  code!: string;

  @Column({ type: 'enum', enum: PermissionModule })
  module!: PermissionModule;

  @Column({ type: 'enum', enum: PermissionAction })
  action!: PermissionAction;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string | null;

  @ManyToMany(() => RoleEntity, (role) => role.permissions)
  roles!: RoleEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}
