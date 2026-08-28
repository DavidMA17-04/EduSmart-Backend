import { Injectable } from '@nestjs/common';
import { GroupEntity } from '../../sections/entities/group.entity';
import { User } from '../../users/entities/user.entity';
import {
  AcademicPeriodReportItem,
  AcademicStructureReportItem,
  UserReportItem,
} from '../interfaces/administrative-report.interface';
import { AdministrativeReportsRepository } from '../repositories/administrative-reports.repository';

interface PersonNameFields {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  first_lastname?: string | null;
  second_lastname?: string | null;
  email?: string | null;
}

@Injectable()
export class AdministrativeReportsService {
  constructor(private readonly repository: AdministrativeReportsRepository) {}

  async getUsersReport(): Promise<UserReportItem[]> {
    const users = await this.repository.findUsers();
    return users.map((user) => this.toUserReportItem(user));
  }

  async getAcademicStructureReport(): Promise<AcademicStructureReportItem[]> {
    const groups = await this.repository.findAcademicStructure();
    return groups.map((group) => this.toAcademicStructureReportItem(group));
  }

  async getAcademicPeriodsReport(): Promise<AcademicPeriodReportItem[]> {
    const periods = await this.repository.findAcademicPeriods();
    return periods.map((period) => ({
      id: period.id,
      name: period.name,
      startDate: period.startDate,
      endDate: period.endDate,
      status: period.status,
      createdAt: period.createdAt,
    }));
  }

  private toUserReportItem(user: User): UserReportItem {
    return {
      id: user.id,
      nationalId: user.national_id,
      fullName: this.buildFullName(user),
      email: user.email,
      phone: user.phone ?? null,
      roles: this.extractRoleNames(user),
      status: user.status,
      createdAt: user.createdAt,
    };
  }

  private toAcademicStructureReportItem(
    group: GroupEntity,
  ): AcademicStructureReportItem {
    const guideTeacher = this.resolveGuideTeacher(group);

    return {
      groupId: group.id,
      groupName: group.name,
      studentCount: group.studentCount,
      sectionId: group.section?.id ?? group.sectionId,
      sectionName: group.section?.name ?? '',
      gradeLevel: group.section?.gradeLevel ?? 0,
      specialty: group.section?.specialty?.name ?? null,
      academicPeriod: group.academicPeriod?.name ?? '',
      guideTeacher: guideTeacher ? this.buildFullName(guideTeacher) : null,
      status: group.status,
    };
  }

  private extractRoleNames(user: User): string[] {
    return (user.userRoles ?? [])
      .map((userRole) => userRole.role?.name)
      .filter((name): name is string => Boolean(name));
  }

  private resolveGuideTeacher(group: GroupEntity): User | null {
    const assignment = (group.teachingAssignments ?? []).find(
      (item) => item.isGuideTeacher && item.user,
    );
    return assignment?.user ?? null;
  }

  private buildFullName(person: PersonNameFields): string {
    if (person.name && person.name.trim().length > 0) {
      return person.name.trim();
    }

    const lastName =
      person.lastName ||
      [person.first_lastname, person.second_lastname].filter(Boolean).join(' ');
    const composed = [person.firstName, lastName].filter(Boolean).join(' ').trim();

    return composed || person.email || '';
  }
}
