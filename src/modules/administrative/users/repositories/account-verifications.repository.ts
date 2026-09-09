import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { AccountVerification } from '../entities/account-verification.entity';

@Injectable()
export class AccountVerificationsRepository {
  constructor(
    @InjectRepository(AccountVerification)
    private readonly repository: Repository<AccountVerification>,
  ) {}

  create(data: Partial<AccountVerification>): AccountVerification {
    return this.repository.create(data);
  }

  save(entity: AccountVerification): Promise<AccountVerification> {
    return this.repository.save(entity);
  }

  findActiveByUserId(userId: number): Promise<AccountVerification | null> {
    return this.repository.findOne({
      where: { userId, consumedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async invalidateActiveForUser(userId: number): Promise<void> {
    await this.repository.update(
      { userId, consumedAt: IsNull() },
      { consumedAt: new Date() },
    );
  }

  countCreatedSince(userId: number, since: Date): Promise<number> {
    return this.repository.count({
      where: {
        userId,
        createdAt: MoreThan(since),
      },
    });
  }
}
