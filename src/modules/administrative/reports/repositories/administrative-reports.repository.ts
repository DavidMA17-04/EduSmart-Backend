import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
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
    private readonly users: Repository<User>,
    @InjectRepository(GroupEntity)
    private readonly groups: Repository<GroupEntity>,
    @InjectRepository(AcademicPeriod)
    private readonly academicPeriods: Repository<AcademicPeriod>,
  ) {}

  findUsers(filters: UserReportFilterDto): Promise<User[]> {
    const qb = this.users
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.userRoles', 'userRoles')
      .leftJoinAndSelect('userRoles.role', 'role')
      .select([
        'user.id',
        'user.national_id',
        'user.name',
        'user.firstName',
        'user.lastName',
        'user.first_lastname',
        'user.second_lastname',
        'user.email',
        'user.phone',
        'user.status',
        'user.createdAt',
        'userRoles.userId',
        'userRoles.roleId',
        'role.id',
        'role.name',
      ]);

    this.applyUserFilters(qb, filters);

    return qb.orderBy('user.name', 'ASC').addOrderBy('user.id', 'ASC').getMany();
  }

  findAcademicStructure(
    filters: AcademicStructureReportFilterDto,
  ): Promise<GroupEntity[]> {
    const qb = this.groups
      .createQueryBuilder('academicGroup')
      .leftJoinAndSelect('academicGroup.section', 'section')
      .leftJoinAndSelect('section.specialty', 'specialty')
      .leftJoinAndSelect('academicGroup.academicPeriod', 'academicPeriod')
      .leftJoinAndSelect(
        'academicGroup.teachingAssignments',
        'assignment',
        'assignment.isGuideTeacher = :isGuideTeacher',
        { isGuideTeacher: true },
      )
      .leftJoinAndSelect('assignment.user', 'guideTeacher')
      .select([
        'academicGroup.id',
        'academicGroup.name',
        'academicGroup.studentCount',
        'academicGroup.sectionId',
        'academicGroup.status',
        'section.id',
        'section.name',
        'section.gradeLevel',
        'specialty.id',
        'specialty.name',
        'academicPeriod.id',
        'academicPeriod.name',
        'assignment.id',
        'assignment.isGuideTeacher',
        'guideTeacher.id',
        'guideTeacher.name',
        'guideTeacher.firstName',
        'guideTeacher.lastName',
        'guideTeacher.first_lastname',
        'guideTeacher.second_lastname',
        'guideTeacher.email',
      ]);

    this.applyAcademicStructureFilters(qb, filters);

    return qb
      .orderBy('section.gradeLevel', 'ASC')
      .addOrderBy('section.name', 'ASC')
      .addOrderBy('academicGroup.name', 'ASC')
      .getMany();
  }

  findAcademicPeriods(
    filters: AcademicPeriodReportFilterDto,
  ): Promise<AcademicPeriod[]> {
    const qb = this.academicPeriods
      .createQueryBuilder('period')
      .select([
        'period.id',
        'period.name',
        'period.startDate',
        'period.endDate',
        'period.status',
        'period.createdAt',
      ]);

    this.applyAcademicPeriodFilters(qb, filters);

    return qb
      .orderBy('period.startDate', 'ASC')
      .addOrderBy('period.id', 'ASC')
      .getMany();
  }

  private applyUserFilters(
    qb: SelectQueryBuilder<User>,
    filters: UserReportFilterDto,
  ): void {
    if (filters.search) {
      const search = `%${filters.search}%`;
      qb.andWhere(
        new Brackets((where) => {
          where
            .where('user.national_id LIKE :search')
            .orWhere('user.name LIKE :search')
            .orWhere('user.firstName LIKE :search')
            .orWhere('user.lastName LIKE :search')
            .orWhere('user.first_lastname LIKE :search')
            .orWhere('user.second_lastname LIKE :search')
            .orWhere('user.email LIKE :search');
        }),
      ).setParameter('search', search);
    }

    if (filters.roleId !== undefined) {
      qb.innerJoin(
        'user.userRoles',
        'filterUserRoles',
        'filterUserRoles.roleId = :roleId',
        { roleId: filters.roleId },
      ).distinct(true);
    }

    if (filters.status !== undefined) {
      qb.andWhere('user.status = :status', { status: filters.status });
    }
  }

  private applyAcademicStructureFilters(
    qb: SelectQueryBuilder<GroupEntity>,
    filters: AcademicStructureReportFilterDto,
  ): void {
    if (filters.academicPeriodId !== undefined) {
      qb.andWhere('academicGroup.academicPeriodId = :academicPeriodId', {
        academicPeriodId: filters.academicPeriodId,
      });
    }

    if (filters.gradeLevel !== undefined) {
      qb.andWhere('section.gradeLevel = :gradeLevel', {
        gradeLevel: filters.gradeLevel,
      });
    }

    if (filters.specialtyId !== undefined) {
      qb.andWhere('section.specialtyId = :specialtyId', {
        specialtyId: filters.specialtyId,
      });
    }

    if (filters.status !== undefined) {
      qb.andWhere('academicGroup.status = :status', { status: filters.status });
    }
  }

  private applyAcademicPeriodFilters(
    qb: SelectQueryBuilder<AcademicPeriod>,
    filters: AcademicPeriodReportFilterDto,
  ): void {
    if (filters.status !== undefined) {
      qb.andWhere('period.status = :status', { status: filters.status });
    }

    if (filters.startDate !== undefined) {
      qb.andWhere('period.startDate >= :startDate', {
        startDate: filters.startDate,
      });
    }

    if (filters.endDate !== undefined) {
      qb.andWhere('period.endDate <= :endDate', { endDate: filters.endDate });
    }
  }
}
