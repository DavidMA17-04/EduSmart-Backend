import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { RoleEntity } from '../../roles/entities/role.entity';
import { User } from './user.entity';

@Entity({ name: 'user_roles' })
export class UserRoleEntity {
  @PrimaryColumn({ name: 'id_users', type: 'int' })
  userId!: number;

  @PrimaryColumn({ name: 'id_roles', type: 'int' })
  roleId!: number;

  @CreateDateColumn({ name: 'assigned_at', type: 'datetime' })
  assignedAt!: Date;

  @ManyToOne(() => User, (user) => user.userRoles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_users' })
  user!: User;

  @ManyToOne(() => RoleEntity, (role) => role.userRoles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_roles' })
  role!: RoleEntity;
}
