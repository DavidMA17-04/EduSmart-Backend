import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../administrative/users/entities/user.entity';

@Injectable()
export class AuthRepository {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({
      where: { email },
      relations: {
        userRoles: { role: { rolePermissions: { permission: true } } },
      },
    });
  }

  findById(id: number): Promise<User | null> {
    return this.users.findOne({
      where: { id },
      relations: {
        userRoles: { role: { rolePermissions: { permission: true } } },
      },
    });
  }

  async touchLastLogin(id: number): Promise<void> {
    await this.users.update({ id }, { lastLoginAt: new Date() });
  }
}
