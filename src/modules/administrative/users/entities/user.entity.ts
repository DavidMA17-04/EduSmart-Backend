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

  /** Alias de compatibilidad id_users */
  get id_users(): number {
    return this.id;
  }
  set id_users(value: number) {
    this.id = value;
  }

  /** Identificación / Cédula única (national_id) */
  @Column({ name: 'national_id', type: 'varchar', length: 30, unique: true })
  national_id!: string;

  get nationalId(): string {
    return this.national_id;
  }
  set nationalId(value: string) {
    this.national_id = value;
  }

  /** Nombres de pila */
  @Column({ name: 'name', type: 'varchar', length: 100, nullable: false })
  name!: string;

  /** Primer Apellido */
  @Column({ name: 'first_lastname', type: 'varchar', length: 100, nullable: false })
  first_lastname!: string;

  /** Segundo Apellido (opcional) */
  @Column({ name: 'second_lastname', type: 'varchar', length: 100, nullable: true })
  second_lastname?: string | null;

  /** Correo Electrónico Institucional único */
  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  /** Teléfono de contacto */
  @Column({ type: 'varchar', length: 30, nullable: true })
  phone?: string | null;

  /** Hash de contraseña de acceso */
  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  password_hash!: string;

  get passwordHash(): string {
    return this.password_hash;
  }
  set passwordHash(value: string) {
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
  mustChangePassword!: boolean;

  get must_change_password(): boolean {
    return this.mustChangePassword;
  }
  set must_change_password(value: boolean) {
    this.mustChangePassword = value;
  }

  /** Última fecha de inicio de sesión */
  @Column({ name: 'last_login_at', type: 'datetime', nullable: true })
  lastLoginAt?: Date | null;

  get last_login_at(): Date | null | undefined {
    return this.lastLoginAt;
  }
  set last_login_at(value: Date | null | undefined) {
    this.lastLoginAt = value;
  }

  /** Roles institucionales asignados a través de user_roles */
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
