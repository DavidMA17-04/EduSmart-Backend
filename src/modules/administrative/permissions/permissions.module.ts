import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissionEntity } from './entities/permission.entity';
import { PermissionsService } from './services/permissions.service';
import { PermissionsRepository } from './repositories/permissions.repository';

@Module({
  imports: [TypeOrmModule.forFeature([PermissionEntity])],

  providers: [PermissionsService, PermissionsRepository],
  exports: [PermissionsService, PermissionsRepository],
})
export class PermissionsModule {}
