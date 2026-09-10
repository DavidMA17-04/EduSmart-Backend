import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../administrative/users/entities/user.entity';

const USER_AUTH_RELATIONS = {
  userRoles: { role: { rolePermissions: { permission: true } } },
} as const;

@Injectable()
export class AuthRepository {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({
      where: { email },
      relations: USER_AUTH_RELATIONS,
    });
  }

  findByIdentifier(identifier: string): Promise<User | null> {
    const trimmed = identifier.trim();
    const email = trimmed.toLowerCase();

    return this.users.findOne({
      where: [{ email }, { national_id: trimmed }],
      relations: USER_AUTH_RELATIONS,
    });
  }

  findById(id: number): Promise<User | null> {
    return this.users.findOne({
      where: { id },
      relations: USER_AUTH_RELATIONS,
    });
  }

  async touchLastLogin(id: number): Promise<void> {
    await this.users.update({ id }, { lastLoginAt: new Date() });
  }

  save(user: User): Promise<User> {
    return this.users.save(user);
  }
}
