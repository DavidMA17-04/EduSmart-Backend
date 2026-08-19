import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '../entities/auth-user.entity';

export type AuthUserRecord = Pick<AuthUser, 'id' | 'email' | 'name' | 'passwordHash'>;

@Injectable()
export class AuthRepository {
  constructor(
    @InjectRepository(AuthUser)
    private readonly users: Repository<AuthUser>,
  ) {}

  findByEmail(email: string): Promise<AuthUserRecord | null> {
    return this.users.findOne({ where: { email } });
  }

  findById(id: string): Promise<AuthUserRecord | null> {
    return this.users.findOne({ where: { id } });
  }

  createUser(data: Pick<AuthUser, 'email' | 'name' | 'passwordHash'>): Promise<AuthUser> {
    return this.users.save(this.users.create(data));
  }
}
