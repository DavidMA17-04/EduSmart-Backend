import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { AcademicPeriod } from '../../academic-periods/entities/academic-period.entity';
import { GroupEntity } from '../../sections/entities/group.entity';
import { User } from '../../users/entities/user.entity';
import { AcademicPeriodReportFilterDto } from '../dto/academic-period-report-filter.dto';
import { AcademicStructureReportFilterDto } from '../dto/academic-structure-report-filter.dto';
import { UserReportFilterDto } from '../dto/user-report-filter.dto';

@Injectable()
export class AdministrativeReportsRepository {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    @InjectRepository(GroupEntity)
    private readonly groupsRepository: Repository<GroupEntity>,

    @InjectRepository(AcademicPeriod)
    private readonly academicPeriodsRepository: Repository<AcademicPeriod>,
  ) {}

  async findUsers(filters: UserReportFilterDto): Promise<User[]> {
    const query = this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.userRoles', 'userRole')
      .leftJoinAndSelect('userRole.role', 'role')
      .select([
        'user.id',
        'user.national_id',
        'user.name',
        'user.first_lastname',
        'user.second_lastname',
        'user.email',
        'user.phone',
        'user.status',
        'user.createdAt',
        'userRole.userId',
        'userRole.roleId',
        'role.id',
        'role.name',
      ]);

    if (filters.search?.trim()) {
      const search = `%${filters.search.trim()}%`;

      query.andWhere(
        new Brackets((qb) => {
          qb.where('user.national_id LIKE :search', { search })
            .orWhere('user.name LIKE :search', { search })
            .orWhere('user.first_lastname LIKE :search', { search })
            .orWhere('user.second_lastname LIKE :search', { search })
            .orWhere('user.email LIKE :search', { search })
            .orWhere('user.phone LIKE :search', { search });
        }),
      );
    }

    if (filters.roleId) {
      query.andWhere('role.id = :roleId', {
        roleId: filters.roleId,
      });
    }

    if (filters.status) {
      query.andWhere('user.status = :status', {
        status: filters.status,
      });
    }

    return query
      .orderBy('user.name', 'ASC')
      .addOrderBy('user.first_lastname', 'ASC')
      .addOrderBy('user.second_lastname', 'ASC')
      .getMany();
  }

  async findAcademicStructure(
    filters: AcademicStructureReportFilterDto,
  ): Promise<GroupEntity[]> {
    const query = this.groupsRepository
      .createQueryBuilder('group')
      .leftJoinAndSelect('group.section', 'section')
      .leftJoinAndSelect('section.specialty', 'specialty')
      .leftJoinAndSelect('group.academicPeriod', 'academicPeriod')
      .leftJoinAndSelect(
        'group.teachingAssignments',
        'teachingAssignment',
      )
      .leftJoinAndSelect(
        'teachingAssignment.user',
        'guideTeacher',
      )
      .select([
        'group.id',
        'group.name',
        'group.studentCount',
        'group.status',
        'section.id',
        'section.name',
        'section.gradeLevel',
        'academicPeriod.id',
        'academicPeriod.name',
        'specialty.id',
        'specialty.name',
        'teachingAssignment.id',
        'teachingAssignment.isGuideTeacher',
        'guideTeacher.id',
        'guideTeacher.name',
        'guideTeacher.first_lastname',
        'guideTeacher.second_lastname',
        'guideTeacher.email',
      ]);

    if (filters.academicPeriodId) {
      query.andWhere('academicPeriod.id = :academicPeriodId', {
        academicPeriodId: filters.academicPeriodId,
      });
    }

    if (filters.gradeLevel) {
      query.andWhere('section.gradeLevel = :gradeLevel', {
        gradeLevel: filters.gradeLevel,
      });
    }

    if (filters.specialtyId) {
      query.andWhere('specialty.id = :specialtyId', {
        specialtyId: filters.specialtyId,
      });
    }

    if (filters.status) {
      query.andWhere('group.status = :status', {
        status: filters.status,
      });
    }

    return query
      .orderBy('academicPeriod.name', 'DESC')
      .addOrderBy('section.gradeLevel', 'ASC')
      .addOrderBy('group.name', 'ASC')
      .getMany();
  }

  async findAcademicPeriods(
    filters: AcademicPeriodReportFilterDto,
  ): Promise<AcademicPeriod[]> {
    const query = this.academicPeriodsRepository
      .createQueryBuilder('academicPeriod')
      .select([
        'academicPeriod.id',
        'academicPeriod.name',
        'academicPeriod.startDate',
        'academicPeriod.endDate',
        'academicPeriod.status',
        'academicPeriod.createdAt',
      ]);

    if (filters.status) {
      query.andWhere('academicPeriod.status = :status', {
        status: filters.status,
      });
    }

    if (filters.startDate) {
      query.andWhere('academicPeriod.startDate >= :startDate', {
        startDate: filters.startDate,
      });
    }

    if (filters.endDate) {
      query.andWhere('academicPeriod.endDate <= :endDate', {
        endDate: filters.endDate,
      });
    }

    return query
      .orderBy('academicPeriod.startDate', 'DESC')
      .getMany();
  }
}