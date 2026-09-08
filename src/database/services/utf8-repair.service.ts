import { Injectable, Logger } from '@nestjs/common';
import {
  INSTITUTIONAL_ROLE_DESCRIPTIONS,
  PERMISSION_DESCRIPTIONS,
} from '../../common/constants/permission-descriptions.constant';
import { hasMojibake } from '../../common/utils/text-encoding.util';
import { PermissionsRepository } from '../../modules/administrative/permissions/repositories/permissions.repository';
import { RolesRepository } from '../../modules/administrative/roles/repositories/roles.repository';
import { SpecialtiesRepository } from '../../modules/administrative/specialties/repositories/specialties.repository';

@Injectable()
export class Utf8RepairService {
  private readonly logger = new Logger(Utf8RepairService.name);

  constructor(
    private readonly permissionsRepository: PermissionsRepository,
    private readonly rolesRepository: RolesRepository,
    private readonly specialtiesRepository: SpecialtiesRepository,
  ) {}

  async repairAll(): Promise<void> {
    await this.repairPermissions();
    await this.repairRoles();
    await this.repairSpecialties();
  }

  private async repairPermissions(): Promise<void> {
    const permissions = await this.permissionsRepository.findAll();
    let repaired = 0;

    for (const permission of permissions) {
      const expected = PERMISSION_DESCRIPTIONS[permission.code];
      if (!expected || !hasMojibake(permission.description)) continue;

      permission.description = expected;
      await this.permissionsRepository.save(permission);
      repaired += 1;
    }

    if (repaired > 0) {
      this.logger.log(`Repaired UTF-8 text in ${repaired} permission(s).`);
    }
  }

  private async repairRoles(): Promise<void> {
    const roles = await this.rolesRepository.findAll();
    let repaired = 0;

    for (const role of roles) {
      const expected = INSTITUTIONAL_ROLE_DESCRIPTIONS[role.name];
      if (!expected || !hasMojibake(role.description)) continue;

      role.description = expected;
      await this.rolesRepository.save(role);
      repaired += 1;
    }

    if (repaired > 0) {
      this.logger.log(`Repaired UTF-8 text in ${repaired} role(s).`);
    }
  }

  private async repairSpecialties(): Promise<void> {
    const specialties = await this.specialtiesRepository.findAll();
    let removed = 0;

    for (const specialty of specialties) {
      if (!hasMojibake(specialty.name) && !hasMojibake(specialty.description)) {
        continue;
      }

      await this.specialtiesRepository.remove(specialty);
      removed += 1;
    }

    if (removed > 0) {
      this.logger.log(`Removed ${removed} specialty row(s) with corrupted UTF-8 text.`);
    }
  }
}
