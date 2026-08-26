import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserStatus } from '../../../../common/enums/user-status.enum';
import { RoleEntity } from '../../roles/entities/role.entity';
import { UserRoleEntity } from './user-role.entity';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id_users' })
  id!: number;

  @Column({ type: 'varchar', length: 150, nullable: true })
  name?: string;

  @Column({ name: 'national_id', type: 'varchar', length: 30, unique: true })
  nationalId!: string;

  @Column({ name: 'first_name', type: 'varchar', length: 100 })
  firstName!: string;

  @Column({ name: 'last_name', type: 'varchar', length: 100 })
  lastName!: string;

  @Column({ name: 'first_lastname', type: 'varchar', length: 100, nullable: true })
  first_lastname?: string | null;

  @Column({ name: 'second_lastname', type: 'varchar', length: 100, nullable: true })
  second_lastname?: string | null;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone?: string | null;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  status!: UserStatus;

  @Column({ name: 'must_change_password', type: 'boolean', default: true })
  mustChangePassword!: boolean;

  @Column({ name: 'last_login_at', type: 'datetime', nullable: true })
  lastLoginAt?: Date | null;

  @OneToMany(() => UserRoleEntity, (userRole) => userRole.user, {
    cascade: true,
  })
  userRoles?: UserRoleEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  get roles(): RoleEntity[] {
    return (this.userRoles ?? [])
      .map((row) => row.role)
      .filter((role): role is RoleEntity => Boolean(role));
  }
}
