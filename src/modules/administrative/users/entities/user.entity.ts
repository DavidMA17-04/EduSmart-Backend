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

  /** Alias de compatibilidad id_users */
  get id_users(): string {
    return this.id;
  }
  set id_users(value: string) {
    this.id = value;
  }

  /** Identificación / Cédula única (national_id) */
  @Column({ name: 'national_id', type: 'varchar', length: 30, nullable: true, unique: true })
  national_id?: string | null;

  get nationalId(): string | null | undefined {
    return this.national_id;
  }
  set nationalId(value: string | null | undefined) {
    this.national_id = value;
  }

  /** Nombres de pila del usuario */
  @Column({ type: 'varchar', length: 100, nullable: true })
  name?: string;

  /** Primer Apellido */
  @Column({ name: 'first_lastname', type: 'varchar', length: 100, nullable: true })
  first_lastname?: string | null;

  /** Segundo Apellido */
  @Column({ name: 'second_lastname', type: 'varchar', length: 100, nullable: true })
  second_lastname?: string | null;

  /** Correo Electrónico Institucional único */
  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  email?: string | null;

  /** Teléfono de contacto */
  @Column({ type: 'varchar', length: 30, nullable: true })
  phone?: string | null;

  /** Hash de contraseña de acceso */
  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true })
  password_hash?: string | null;

  get passwordHash(): string | null | undefined {
    return this.password_hash;
  }
  set passwordHash(value: string | null | undefined) {
    this.password_hash = value;
  }

  /** Estado del usuario */
  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  status!: UserStatus;

  /** Indicador de cambio obligatorio de contraseña en primer inicio */
  @Column({ name: 'must_change_password', type: 'boolean', default: true })
  must_change_password?: boolean;

  /** Última fecha de inicio de sesión */
  @Column({ name: 'last_login_at', type: 'datetime', nullable: true, default: null })
  last_login_at?: Date | null;

  /** Roles institucionales asignados */
  @ManyToMany(() => RoleEntity, { cascade: false })
  @JoinTable({
    name: 'user_roles',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' },
  })
  roles?: RoleEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
