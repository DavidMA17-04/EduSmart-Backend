import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../administrative/users/entities/user.entity';
import { RoleEntity } from '../administrative/roles/entities/role.entity';
import { AcademicPeriod } from '../administrative/academic-periods/entities/academic-period.entity';
import { UserRoleEntity } from '../administrative/users/entities/user-role.entity';
import { SectionEntity } from '../administrative/sections/entities/section.entity';
import { SpecialtyEntity } from '../administrative/specialties/entities/specialty.entity';
import { UserStatus } from '../../common/enums/user-status.enum';
import { DashboardSummaryDto } from './dto/dashboard-summary.dto';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
    @InjectRepository(AcademicPeriod)
    private readonly academicPeriodRepo: Repository<AcademicPeriod>,
    @InjectRepository(UserRoleEntity)
    private readonly userRoleRepo: Repository<UserRoleEntity>,
    @InjectRepository(SectionEntity)
    private readonly sectionRepo: Repository<SectionEntity>,
    @InjectRepository(SpecialtyEntity)
    private readonly specialtyRepo: Repository<SpecialtyEntity>,
  ) {}

  async getSummary(): Promise<DashboardSummaryDto> {
    const [totalUsers, activeUsers, totalRoles, totalAcademicPeriods, totalSections, totalSpecialties, usersByRole] =
      await Promise.all([
        this.userRepo.count(),
        this.userRepo.count({ where: { status: UserStatus.ACTIVE } }),
        this.roleRepo.count(),
        this.academicPeriodRepo.count(),
        this.sectionRepo.count(),
        this.specialtyRepo.count(),
        this.userRoleRepo
          .createQueryBuilder('ur')
          .innerJoin('ur.role', 'role')
          .select('role.name', 'role')
          .addSelect('COUNT(*)', 'count')
          .groupBy('role.name')
          .getRawMany<{ role: string; count: string }>(),
      ]);

    return {
      totalUsers,
      activeUsers,
      totalRoles,
      totalAcademicPeriods,
      totalSections,
      totalSpecialties,
      usersByRole: usersByRole.map((r) => ({ role: r.role, count: Number(r.count) })),
    };
  }
}
