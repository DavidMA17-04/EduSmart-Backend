import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { PasswordResetToken } from '../entities/password-reset-token.entity';

@Injectable()
export class PasswordResetTokensRepository {
  constructor(
    @InjectRepository(PasswordResetToken)
    private readonly repository: Repository<PasswordResetToken>,
  ) {}

  create(data: Partial<PasswordResetToken>): PasswordResetToken {
    return this.repository.create(data);
  }

  save(entity: PasswordResetToken): Promise<PasswordResetToken> {
    return this.repository.save(entity);
  }

  findActiveByHash(tokenHash: string): Promise<PasswordResetToken | null> {
    return this.repository.findOne({
      where: {
        tokenHash,
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });
  }

  async invalidateOpenForUser(userId: number): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .update(PasswordResetToken)
      .set({ usedAt: new Date() })
      .where('userId = :userId', { userId })
      .andWhere('usedAt IS NULL')
      .execute();
  }
}
