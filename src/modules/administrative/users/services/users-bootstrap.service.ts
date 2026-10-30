import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PermissionAction } from '../../../../common/enums/permission-action.enum';
import { PermissionModule } from '../../../../common/enums/permission-module.enum';
import { RoleStatus } from '../../../../common/enums/role-status.enum';
import {
  INSTITUTIONAL_ROLE_ADMIN,
  INSTITUTIONAL_ROLE_STUDENT,
  INSTITUTIONAL_ROLE_TEACHER,
} from '../../../../common/constants/institutional-roles.constant';
import { PERMISSION_DESCRIPTIONS } from '../../../../common/constants/permission-descriptions.constant';
import { PERMISSIONS } from '../../../../common/constants/permissions.constant';
import { SpecialtyStatus } from '../../../../common/enums/specialty-status.enum';
import { UserStatus } from '../../../../common/enums/user-status.enum';
import { AcademicPeriodStatus } from '../../academic-periods/enums/academic-period-status.enum';
import { AcademicPeriodsRepository } from '../../academic-periods/repositories/academic-periods.repository';
import { PermissionsRepository } from '../../permissions/repositories/permissions.repository';
import { RolesRepository } from '../../roles/repositories/roles.repository';
import { SpecialtiesRepository } from '../../specialties/repositories/specialties.repository';
import { UsersRepository } from '../repositories/users.repository';
import { Utf8RepairService } from '../../../../database/services/utf8-repair.service';

const DEFAULT_ADMIN_EMAIL = 'admin@ctphojancha.ed.cr';
const DEFAULT_ADMIN_PASSWORD = 'Admin1234';
const DEFAULT_ADMIN_NATIONAL_ID = '100000000';

@Injectable()
export class UsersBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(UsersBootstrapService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly rolesRepository: RolesRepository,
    private readonly permissionsRepository: PermissionsRepository,
    private readonly academicPeriodsRepository: AcademicPeriodsRepository,
    private readonly specialtiesRepository: SpecialtiesRepository,
    private readonly utf8RepairService: Utf8RepairService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.utf8RepairService.repairAll();
    const permissions = await this.ensurePermissions();

    const adminRole = await this.ensureAdminRole(permissions.map((item) => item.id));

    if (!adminRole) {
      throw new Error('No se pudo sembrar el rol Administrador');
    }

    await this.ensureTeacherRole();
    await this.ensureStudentRole();
    await this.ensureOwnSchedulePermission();
    await this.ensureAdminUser(adminRole.id);
    await this.ensureAcademicPeriod();
    await this.ensureSpecialty();
  }

  private async ensurePermissions() {
    const existing = await this.permissionsRepository.findAll();

    const codes = new Set(existing.map((item) => item.code));
    for (const code of new Set(Object.values(PERMISSIONS))) {
      if (codes.has(code)) continue;
      const dot = code.lastIndexOf('.');
      const module = code.slice(0, dot).toUpperCase() as PermissionModule;
      const action = code.slice(dot + 1).toUpperCase() as PermissionAction;
      await this.permissionsRepository.save(this.permissionsRepository.create({
        code, module, action, description: PERMISSION_DESCRIPTIONS[code] ?? code,
      }));
    }

    return this.permissionsRepository.findAll();
  }

  private async ensureAdminRole(permissionIds: number[]) {
    const existing = await this.rolesRepository.findByName(INSTITUTIONAL_ROLE_ADMIN);

    if (existing) {
      if (permissionIds.some((id) => !(existing.rolePermissions ?? []).some((row) => row.permissionId === id))) {
        await this.rolesRepository.setPermissionIds(existing.id, [...new Set([...(existing.rolePermissions ?? []).map((row) => row.permissionId), ...permissionIds])]);
      }

      return (await this.rolesRepository.findByName(INSTITUTIONAL_ROLE_ADMIN)) ?? existing;
    }

    const role = await this.rolesRepository.save(
      this.rolesRepository.create({
        name: INSTITUTIONAL_ROLE_ADMIN,
        description: 'Acceso completo al módulo administrativo',
        isSystemRole: true,
        status: RoleStatus.ACTIVE,
      }),
    );

    await this.rolesRepository.setPermissionIds(role.id, permissionIds);

    return (await this.rolesRepository.findById(role.id)) ?? role;
  }

  private async ensureTeacherRole() {
    const existing = await this.rolesRepository.findByName(INSTITUTIONAL_ROLE_TEACHER);

    if (existing) {
      return existing;
    }

    return this.rolesRepository.save(
      this.rolesRepository.create({
        name: INSTITUTIONAL_ROLE_TEACHER,
        description: 'Personal docente. Puede asignarse como docente guía de una sección.',
        isSystemRole: true,
        status: RoleStatus.ACTIVE,
      }),
    );
  }

  private async ensureStudentRole() {
    const byTitle = await this.rolesRepository.findByName(INSTITUTIONAL_ROLE_STUDENT);

    if (byTitle) {
      return byTitle;
    }

    const byCode = await this.rolesRepository.findByName('ESTUDIANTE');

    if (byCode) {
      return byCode;
    }

    return this.rolesRepository.save(
      this.rolesRepository.create({
        name: INSTITUTIONAL_ROLE_STUDENT,
        description: 'Estudiante institucional. Destinatario de la importación masiva de usuarios.',
        isSystemRole: true,
        status: RoleStatus.ACTIVE,
      }),
    );
  }

  /**
   * GET /schedule/my-schedule requires schedules.view_own. Catalog cartesian
   * skips VIEW_OWN, so local DBs often keep only schedules.view on Estudiante.
   */
  private async ensureOwnSchedulePermission() {
    const code = PERMISSIONS.SCHEDULES_VIEW_OWN;
    let permission = await this.permissionsRepository.findByCode(code);
    if (!permission) {
      permission = await this.permissionsRepository.save(
        this.permissionsRepository.create({
          code,
          module: PermissionModule.SCHEDULES,
          action: PermissionAction.VIEW_OWN,
          description: PERMISSION_DESCRIPTIONS[code] ?? 'Ver el propio horario',
        }),
      );
    }

    await this.grantPermissionToRoles(permission.id, [
      INSTITUTIONAL_ROLE_TEACHER,
      INSTITUTIONAL_ROLE_STUDENT,
    ]);
    await this.revokePermissionCodesFromRole(INSTITUTIONAL_ROLE_STUDENT, [
      PERMISSIONS.SCHEDULES_VIEW,
      PERMISSIONS.SCHEDULES_EDIT,
    ]);
  }

  private async grantPermissionToRoles(permissionId: number, roleNames: string[]) {
    for (const name of roleNames) {
      const role = await this.rolesRepository.findByName(name);
      if (!role) continue;
      const ids = new Set(
        (role.rolePermissions ?? []).map((row) => row.permissionId).filter(Boolean),
      );
      if (ids.has(permissionId)) continue;
      ids.add(permissionId);
      await this.rolesRepository.setPermissionIds(role.id, [...ids]);
    }
  }

  private async revokePermissionCodesFromRole(roleName: string, codes: string[]) {
    const role = await this.rolesRepository.findByName(roleName);
    if (!role) return;
    const deny = new Set(codes);
    const kept = (role.rolePermissions ?? [])
      .filter((row) => row.permission && !deny.has(row.permission.code))
      .map((row) => row.permissionId);
    if (kept.length === (role.rolePermissions ?? []).length) return;
    await this.rolesRepository.setPermissionIds(role.id, kept);
  }

  private async ensureAdminUser(roleId: number) {
    const email = (process.env.ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL).trim().toLowerCase();

    const password = process.env.ADMIN_PASSWORD ?? DEFAULT_ADMIN_PASSWORD;

    const existing = await this.usersRepository.findByEmail(email);

    if (existing) {
      return;
    }

    const user = await this.usersRepository.save(
      this.usersRepository.create({
        national_id: DEFAULT_ADMIN_NATIONAL_ID,
        name: 'Administrador',
        first_lastname: 'CTP Hojancha',
        second_lastname: null,
        email,
        password_hash: await bcrypt.hash(password, 10),
        status: UserStatus.ACTIVE,
        mustChangePassword: false,
      }),
    );

    await this.usersRepository.replaceRoles(user.id, [{ id: roleId }]);

    this.logger.log(`Admin user seeded: ${email}`);
  }

  private async ensureAcademicPeriod() {
    const periods = await this.academicPeriodsRepository.findAll();

    if (periods.length) {
      return;
    }

    await this.academicPeriodsRepository.create({
      name: '2026',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      status: AcademicPeriodStatus.ACTIVE,
    });
  }

  private async ensureSpecialty() {
    const existing = await this.specialtiesRepository.findByName('Informática');

    if (existing) {
      return;
    }

    await this.specialtiesRepository.save(
      this.specialtiesRepository.create({
        name: 'Informática',
        description: 'Especialidad técnica de ejemplo para últimos años',
        status: SpecialtyStatus.ACTIVE,
      }),
    );
  }
}
