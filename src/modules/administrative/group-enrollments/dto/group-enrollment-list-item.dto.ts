import { GroupEnrollmentStatus } from '../../../../common/enums/group-enrollment-status.enum';

export class GroupEnrollmentStudentSummaryDto {
  id!: number;
  name!: string;
  firstLastname!: string;
  secondLastname?: string | null;
  nationalId!: string;
  email!: string;
}

export class GroupEnrollmentListItemDto {
  id!: number;
  userId!: number;
  groupId!: number;
  academicPeriodId!: number;
  startsOn!: string;
  endsOn!: string | null;
  status!: GroupEnrollmentStatus;
  user!: GroupEnrollmentStudentSummaryDto;
}
