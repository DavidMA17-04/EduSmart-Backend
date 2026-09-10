import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { UserSession } from '../entities/user-session.entity';

@Injectable()
export class UserSessionsRepository {
  constructor(
    @InjectRepository(UserSession)
    private readonly repository: Repository<UserSession>,
  ) {}

  create(data: Partial<UserSession>): UserSession {
    return this.repository.create(data);
  }

  save(entity: UserSession): Promise<UserSession> {
    return this.repository.save(entity);
  }

  findById(id: number): Promise<UserSession | null> {
    return this.repository.findOne({ where: { id } });
  }

  findActiveByUser(userId: number): Promise<UserSession[]> {
    return this.repository.find({
      where: {
        userId,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async revoke(id: number): Promise<void> {
    await this.repository.update({ id }, { revokedAt: new Date() });
  }

  async revokeAllForUser(userId: number): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .update(UserSession)
      .set({ revokedAt: new Date() })
      .where('userId = :userId', { userId })
      .andWhere('revokedAt IS NULL')
      .execute();
  }
}
