import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SpecialtyKind } from '../../common/enums/specialty-kind.enum';
import { UserStatus } from '../../common/enums/user-status.enum';
import { SectionEntity } from '../administrative/sections/entities/section.entity';
import { SpecialtyEntity } from '../administrative/specialties/entities/specialty.entity';
import { User } from '../administrative/users/entities/user.entity';

export interface CampusSnapshotDto {
  activeUsers: number;
  totalUsers: number;
  totalSpecialties: number;
  totalExploratoryWorkshops: number;
  totalSections: number;
}

@Injectable()
export class PublicService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(SpecialtyEntity)
    private readonly specialtyRepo: Repository<SpecialtyEntity>,
    @InjectRepository(SectionEntity)
    private readonly sectionRepo: Repository<SectionEntity>,
  ) {}

  async getCampusSnapshot(): Promise<CampusSnapshotDto> {
    const [
      totalUsers,
      activeUsers,
      totalSections,
      totalExploratoryWorkshops,
      totalSpecialties,
    ] = await Promise.all([
      this.userRepo.count(),
      this.userRepo.count({ where: { status: UserStatus.ACTIVE } }),
      this.sectionRepo.count(),
      this.specialtyRepo.count({
        where: { kind: SpecialtyKind.EXPLORATORY_WORKSHOP },
      }),
      this.specialtyRepo.count({
        where: { kind: SpecialtyKind.TECHNICAL_SPECIALTY },
      }),
    ]);

    return {
      activeUsers,
      totalUsers,
      totalSpecialties,
      totalExploratoryWorkshops,
      totalSections,
    };
  }
}
