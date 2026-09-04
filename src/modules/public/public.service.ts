import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserStatus } from '../../common/enums/user-status.enum';
import { User } from '../administrative/users/entities/user.entity';

export interface CampusSnapshotDto {
  activeUsers: number;
  totalUsers: number;
}

@Injectable()
export class PublicService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async getCampusSnapshot(): Promise<CampusSnapshotDto> {
    const [totalUsers, activeUsers] = await Promise.all([
      this.userRepo.count(),
      this.userRepo.count({ where: { status: UserStatus.ACTIVE } }),
    ]);

    return { activeUsers, totalUsers };
  }
}
