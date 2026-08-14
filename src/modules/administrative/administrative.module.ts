import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { SpecialtiesModule } from './specialties/specialties.module';
import { SectionsModule } from './sections/sections.module';
import { AcademicPeriodsModule } from './academic-periods/academic-periods.module';
import { BulkImportModule } from './bulk-import/bulk-import.module';

@Module({
  imports: [
    UsersModule,
    RolesModule,
    PermissionsModule,
    SpecialtiesModule,
    SectionsModule,
    AcademicPeriodsModule,
    BulkImportModule,
  ],
  exports: [
    UsersModule,
    RolesModule,
    PermissionsModule,
    SpecialtiesModule,
    SectionsModule,
    AcademicPeriodsModule,
    BulkImportModule,
  ],
})
export class AdministrativeModule {}
