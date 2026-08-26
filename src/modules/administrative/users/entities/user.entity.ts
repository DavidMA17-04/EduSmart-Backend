import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserStatus } from '../../../../common/enums/user-status.enum';
import { RoleEntity } from '../../roles/entities/role.entity';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Nombre de visualización (docentes guía y compatibilidad con listados existentes). */
  @Column({ type: 'varchar', length: 150, nullable: true })
  name?: string;

  @Column({ name: 'national_id', type: 'varchar', length: 20, nullable: true, unique: true })
  nationalId?: string | null;

  @Column({ name: 'first_name', type: 'varchar', length: 80, nullable: true })
  firstName?: string | null;

  @Column({ name: 'last_name', type: 'varchar', length: 120, nullable: true })
  lastName?: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true, unique: true })
  email?: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone?: string | null;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true })
  passwordHash?: string | null;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  status!: UserStatus;

  @ManyToMany(() => RoleEntity, { cascade: false })
  @JoinTable({
    name: 'user_roles',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' },
  })
  roles!: RoleEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
