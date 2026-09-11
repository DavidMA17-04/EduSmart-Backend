import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { SpecialtiesModule } from './specialties/specialties.module';
import { SubjectsModule } from './subjects/subjects.module';
import { SectionsModule } from './sections/sections.module';
import { AcademicPeriodsModule } from './academic-periods/academic-periods.module';
import { AcademicOfferingsModule } from './academic-offerings/academic-offerings.module';
import { TeachingAssignmentsModule } from './teaching-assignments/teaching-assignments.module';
import { GroupEnrollmentsModule } from './group-enrollments/group-enrollments.module';
import { BulkImportModule } from './bulk-import/bulk-import.module';
import { AdministrativeReportsModule } from './reports/administrative-reports.module';

@Module({
  imports: [
    UsersModule,
    RolesModule,
    PermissionsModule,
    SpecialtiesModule,
    SubjectsModule,
    SectionsModule,
    AcademicPeriodsModule,
    AcademicOfferingsModule,
    TeachingAssignmentsModule,
    GroupEnrollmentsModule,
    BulkImportModule,
    AdministrativeReportsModule,
  ],
  exports: [
    UsersModule,
    RolesModule,
    PermissionsModule,
    SpecialtiesModule,
    SubjectsModule,
    SectionsModule,
    AcademicPeriodsModule,
    AcademicOfferingsModule,
    TeachingAssignmentsModule,
    GroupEnrollmentsModule,
    BulkImportModule,
    AdministrativeReportsModule,
  ],
})
export class AdministrativeModule {}
