import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AcademicPeriod } from '../../academic-periods/entities/academic-period.entity';
import { GroupEntity } from '../../sections/entities/group.entity';
import { User } from '../../users/entities/user.entity';

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

  findUsers(): Promise<User[]> {
    return this.users
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
      ])
      .orderBy('user.name', 'ASC')
      .addOrderBy('user.id', 'ASC')
      .getMany();
  }

  findAcademicStructure(): Promise<GroupEntity[]> {
    return this.groups
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
      ])
      .orderBy('section.gradeLevel', 'ASC')
      .addOrderBy('section.name', 'ASC')
      .addOrderBy('academicGroup.name', 'ASC')
      .getMany();
  }

  findAcademicPeriods(): Promise<AcademicPeriod[]> {
    return this.academicPeriods
      .createQueryBuilder('period')
      .select([
        'period.id',
        'period.name',
        'period.startDate',
        'period.endDate',
        'period.status',
        'period.createdAt',
      ])
      .orderBy('period.startDate', 'ASC')
      .addOrderBy('period.id', 'ASC')
      .getMany();
  }
}
