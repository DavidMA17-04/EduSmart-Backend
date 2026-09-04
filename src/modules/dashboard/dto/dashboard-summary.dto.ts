export class UsersByRoleDto {
  role!: string;
  count!: number;
}

export class DashboardSummaryDto {
  totalUsers!: number;
  activeUsers!: number;
  totalRoles!: number;
  totalAcademicPeriods!: number;
  totalSections!: number;
  totalSpecialties!: number;
  usersByRole!: UsersByRoleDto[];
}
