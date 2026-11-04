import { GroupStatus } from '../../../../common/enums/group-status.enum';
import { UserStatus } from '../../../../common/enums/user-status.enum';
import { AcademicPeriodStatus } from '../../academic-periods/enums/academic-period-status.enum';

export interface UserReportItem {
  id: number;
  nationalId: string;
  fullName: string;
  email: string;
  phone: string | null;
  roles: string[];
  status: UserStatus;
  createdAt: Date;
}

export interface AcademicStructureReportItem {
  groupId: number;
  groupName: string;
  studentCount: number;
  sectionId: number;
  sectionName: string;
  gradeLevel: number;
  specialty: string | null;
  academicPeriod: string;
  guideTeacher: string | null;
  status: GroupStatus;
}

export interface AcademicPeriodReportItem {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  status: AcademicPeriodStatus;
  createdAt: Date;
}
