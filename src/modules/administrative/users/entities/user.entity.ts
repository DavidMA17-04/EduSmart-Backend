import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn({ name: 'id_users' })
  id_users!: number;

  @Column({ name: 'national_id', type: 'varchar', length: 30, unique: true })
  national_id!: string;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'first_lastname', type: 'varchar', length: 100 })
  first_lastname!: string;

  @Column({ name: 'second_lastname', type: 'varchar', length: 100, nullable: true })
  second_lastname?: string | null;

  @Column({ name: 'email', type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  password_hash!: string;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: string;

  @Column({ name: 'must_change_password', type: 'boolean', default: true })
  must_change_password!: boolean;

  @Column({ name: 'last_login_at', type: 'datetime', nullable: true, default: null })
  last_login_at?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updated_at!: Date;
}
