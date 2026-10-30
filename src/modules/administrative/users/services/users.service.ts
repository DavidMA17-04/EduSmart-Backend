import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  INSTITUTIONAL_ROLE_ADMIN,
  INSTITUTIONAL_ROLE_STUDENT,
  INSTITUTIONAL_ROLE_TEACHER,
} from '../../../../common/constants/institutional-roles.constant';
import { GroupEnrollmentStatus } from '../../../../common/enums/group-enrollment-status.enum';
import { UserStatus } from '../../../../common/enums/user-status.enum';
import { MailService } from '../../../../integrations/mail/mail.service';
import { tryLoadInstitutionLogoAttachment } from '../../../../integrations/mail/optional-logo.attachment';
import { buildWelcomeCredentialsMail } from '../../../../integrations/mail/templates/welcome-credentials.mail';
import { enrollmentStartDate } from '../../bulk-import/utils/section-group-resolver';
import { DepartmentsService } from '../../departments/services/departments.service';
import { RoleEntity } from '../../roles/entities/role.entity';
import { RolesRepository } from '../../roles/repositories/roles.repository';
import { GroupEnrollment } from '../../group-enrollments/entities/group-enrollment.entity';
import { GroupEnrollmentsService } from '../../group-enrollments/services/group-enrollments.service';
import { TeachingAssignment } from '../../teaching-assignments/entities/teaching-assignment.entity';
import { CreateGuideTeacherDto } from '../dto/create-guide-teacher.dto';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateGuideTeacherDto } from '../dto/update-guide-teacher.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { AuditLog } from '../entities/audit-log.entity';
import { TeacherProfile } from '../entities/teacher-profile.entity';
import { User } from '../entities/user.entity';
import { UserRoleEntity } from '../entities/user-role.entity';
import {
  composeOwnSectionLabel,
  toUserPublicView,
  type OwnEnrollmentView,
  type UserPublicView,
} from '../mappers/user-public.mapper';
import { UsersRepository } from '../repositories/users.repository';
import { AccountVerificationService } from './account-verification.service';
import { AuditLogService } from './audit-log.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly repository: UsersRepository,
    private readonly rolesRepository: RolesRepository,
    private readonly auditLogService: AuditLogService,
    private readonly accountVerificationService: AccountVerificationService,
    private readonly departmentsService: DepartmentsService,
    @InjectRepository(TeachingAssignment)
    private readonly teachingAssignments: Repository<TeachingAssignment>,
    @InjectRepository(TeacherProfile)
    private readonly teacherProfiles: Repository<TeacherProfile>,
    @InjectRepository(GroupEnrollment)
    private readonly groupEnrollments: Repository<GroupEnrollment>,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    private readonly groupEnrollmentsService: GroupEnrollmentsService,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<UserPublicView[]> {
    const users = await this.repository.findAll();
    return users.map(toUserPublicView);
  }

  async findPage(query: {
    page?: number;
    limit?: number;
    status?: UserStatus;
    roleId?: number;
    search?: string;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const [{ items, total }, statusRows, roleRows] = await Promise.all([
      this.repository.findPage({
        page,
        limit,
        status: query.status,
        roleId: query.roleId,
        search: query.search,
      }),
      this.repository.countByStatus(),
      this.repository.countByRole(),
    ]);

    const totalCount = Object.values(statusRows).reduce((sum, n) => sum + n, 0);

    const statusCounts = {
      ALL: totalCount,
      ACTIVE: statusRows[UserStatus.ACTIVE] ?? 0,
      INACTIVE: statusRows[UserStatus.INACTIVE] ?? 0,
      BLOCKED: statusRows[UserStatus.BLOCKED] ?? 0,
      PENDING: statusRows[UserStatus.PENDING] ?? 0,
    };

    return {
      items: items.map(toUserPublicView),
      total,
      page,
      limit,
      totalCount,
      statusCounts,
      roleCounts: roleRows,
    };
  }

  async findGuideTeachers(): Promise<UserPublicView[]> {
    const users = await this.repository.findGuideTeachers();
    return users.map(toUserPublicView);
  }

  async findOne(id: number): Promise<UserPublicView> {
    const user = await this.getByIdOrFail(id);
    return this.withEnrollment(toUserPublicView(user), id);
  }

  /**
   * Ficha propia: identidad institucional + matrícula vigente si existe.
   * No exige students.view ni administrator.view; solo el id de la sesión.
   */
  async findOwnProfile(userId: number): Promise<UserPublicView> {
    return this.findOne(userId);
  }

  async updateProfile(userId: number, dto: UpdateProfileDto): Promise<UserPublicView> {
    return this.update(
      userId,
      {
        name: dto.name,
        first_lastname: dto.first_lastname,
        second_lastname: dto.second_lastname,
        phone: dto.phone,
      },
      userId,
    );
  }

  async findAuditLogs(id: number): Promise<ReturnType<AuditLogService['listForUser']>> {
    await this.getByIdOrFail(id);
    return this.auditLogService.listForUser(id);
  }

  async create(dto: CreateUserDto, actorId?: number): Promise<UserPublicView> {
    const rawNationalId = dto.nationalId ?? dto.national_id ?? '';
    const nationalId = rawNationalId.replace(/-/g, '').trim();
    const email = dto.email.trim().toLowerCase();

    await this.ensureUniqueNationalId(nationalId);
    await this.ensureUniqueEmail(email);

    const roles = await this.resolveRoles(dto.roleIds);
    const status = dto.status ?? UserStatus.ACTIVE;
    this.assertManualEnrollmentRules(roles, status, dto.groupId);

    const name = dto.name.trim();
    const firstLastName = dto.first_lastname.trim();
    const secondLastName = dto.second_lastname?.trim() || null;

    const password = dto.password?.trim() || randomBytes(8).toString('base64url');
    const passwordHash = await bcrypt.hash(password, 10);

    const user = this.repository.create({
      national_id: nationalId,
      nationalId: nationalId,
      name,
      first_lastname: firstLastName,
      second_lastname: secondLastName,
      email,
      phone: dto.phone?.trim() || null,
      status,
      password_hash: passwordHash,
      mustChangePassword: true,
    });

    const savedId = dto.groupId
      ? await this.persistNewUserWithEnrollment({
          user,
          roles,
          actorId,
          groupId: dto.groupId,
          departmentId: dto.departmentId,
        })
      : await this.persistNewUserWithoutEnrollment(user, roles, dto.departmentId, actorId);

    const persisted = await this.repository.findById(savedId);
    if (!persisted) {
      throw new NotFoundException(`User ${savedId} not found`);
    }
    const view: UserPublicView = {
      ...toUserPublicView(persisted),
      ...(dto.groupId ? { enrollment: await this.findOwnEnrollment(savedId) } : {}),
    };

    if (persisted.status === UserStatus.PENDING) {
      await this.accountVerificationService.issueAndSend(persisted.id, actorId ?? null);
    } else if (persisted.status === UserStatus.ACTIVE) {
      await this.sendWelcomeCredentials(persisted, password);
    }

    return view;
  }

  private assertManualEnrollmentRules(
    roles: Array<Pick<RoleEntity, 'name'>>,
    status: UserStatus,
    groupId?: number,
  ): void {
    const isStudent = this.hasStudentRole(roles);
    if (isStudent && status === UserStatus.ACTIVE && !groupId) {
      throw new BadRequestException(
        'La sección es obligatoria al crear un estudiante con estado activo.',
      );
    }
    this.assertGroupIdAllowed(roles, status, groupId);
  }

  private assertGroupIdAllowed(
    roles: Array<Pick<RoleEntity, 'name'>>,
    status: UserStatus,
    groupId?: number,
  ): void {
    if (!groupId) return;
    if (!this.hasStudentRole(roles)) {
      throw new BadRequestException('Solo un usuario con rol Estudiante puede matricularse en una sección.');
    }
    if (status !== UserStatus.ACTIVE) {
      throw new BadRequestException('Solo se matricula un estudiante con estado ACTIVE.');
    }
  }

  private async withEnrollment(view: UserPublicView, userId: number): Promise<UserPublicView> {
    return {
      ...view,
      enrollment: await this.findOwnEnrollment(userId),
    };
  }

  private async assignEnrollmentOnUpdate(input: {
    userId: number;
    roles: Array<Pick<RoleEntity, 'name'>>;
    status: UserStatus;
    groupId: number;
  }): Promise<void> {
    this.assertGroupIdAllowed(input.roles, input.status, input.groupId);

    const existing = await this.groupEnrollments.findOne({
      where: { userId: input.userId, status: GroupEnrollmentStatus.ACTIVE },
    });
    if (existing) {
      if (existing.groupId !== input.groupId) {
        throw new BadRequestException(
          'El traslado de sección se gestiona en Estructura académica.',
        );
      }
      return;
    }

    const group = await this.groupEnrollmentsService.requireGroupForEnrollment(input.groupId);
    try {
      await this.dataSource.transaction(async (manager) => {
        await this.groupEnrollmentsService.enrollNewStudentsInTransaction(manager, {
          groupId: group.groupId,
          academicPeriodId: group.academicPeriodId,
          userIds: [input.userId],
          startsOn: enrollmentStartDate(group.periodStartDate),
        });
      });
    } catch (error) {
      this.rethrowEnrollmentFailure(error);
    }
  }

  private async persistNewUserWithoutEnrollment(
    user: User,
    roles: RoleEntity[],
    departmentId: number | undefined,
    actorId?: number,
  ): Promise<number> {
    const saved = await this.repository.save(user);
    await this.repository.replaceRoles(saved.id, roles);
    await this.syncTeacherProfile(saved.id, roles, departmentId);
    const persisted = (await this.repository.findById(saved.id)) ?? saved;
    await this.auditLogService.record({
      actorId: actorId ?? null,
      action: 'USER_CREATED',
      entity: 'User',
      entityId: String(persisted.id),
      after: toUserPublicView(persisted) as unknown as Record<string, unknown>,
    });
    return persisted.id;
  }

  private async persistNewUserWithEnrollment(input: {
    user: User;
    roles: RoleEntity[];
    actorId?: number;
    groupId: number;
    departmentId?: number;
  }): Promise<number> {
    const group = await this.groupEnrollmentsService.requireGroupForEnrollment(input.groupId);
    if (this.hasTeacherRole(input.roles)) {
      if (!input.departmentId) {
        throw new BadRequestException(
          'El departamento es obligatorio para usuarios con rol Docente.',
        );
      }
      await this.departmentsService.getByIdOrFail(input.departmentId);
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        const saved = await manager.getRepository(User).save(input.user);
        await manager.getRepository(UserRoleEntity).save(
          input.roles.map((role) =>
            manager.getRepository(UserRoleEntity).create({
              userId: saved.id,
              roleId: role.id,
            }),
          ),
        );
        if (this.hasTeacherRole(input.roles) && input.departmentId) {
          await this.saveTeacherProfileInTransaction(manager, saved.id, input.departmentId);
        }
        await this.groupEnrollmentsService.enrollNewStudentsInTransaction(manager, {
          groupId: group.groupId,
          academicPeriodId: group.academicPeriodId,
          userIds: [saved.id],
          startsOn: enrollmentStartDate(group.periodStartDate),
        });
        await manager.getRepository(AuditLog).save(
          manager.getRepository(AuditLog).create({
            actorId: input.actorId ?? null,
            action: 'USER_CREATED',
            entity: 'User',
            entityId: String(saved.id),
            after: {
              source: 'MANUAL',
              email: saved.email,
              groupId: group.groupId,
            },
          }),
        );
        return saved.id;
      });
    } catch (error) {
      this.rethrowEnrollmentFailure(error);
    }
  }

  /**
   * Pre-check department before opening the enrollment transaction.
   * userId -1 is unused: we only want the validation throw.
   */
  private async saveTeacherProfileInTransaction(
    manager: EntityManager,
    userId: number,
    departmentId: number,
  ): Promise<void> {
    await manager.getRepository(TeacherProfile).save(
      manager.getRepository(TeacherProfile).create({ userId, departmentId }),
    );
  }

  private rethrowEnrollmentFailure(error: unknown): never {
    if (error instanceof ConflictException) {
      const body = error.getResponse();
      const message =
        typeof body === 'object' && body !== null && 'message' in body
          ? String((body as { message: unknown }).message)
          : error.message;
      throw new BadRequestException(message);
    }
    throw error;
  }

  /** Mail failure is non-fatal: the user is already persisted. */
  private async sendWelcomeCredentials(user: User, temporaryPassword: string): Promise<void> {
    if (!user.email) {
      return;
    }
    const appUrl =
      this.configService.get<string>('APP_PUBLIC_URL')?.replace(/\/$/, '') ||
      'http://localhost:5173';
    const fullName = [user.name, user.first_lastname, user.second_lastname]
      .filter(Boolean)
      .join(' ');
    try {
      const logo = tryLoadInstitutionLogoAttachment();
      const mail = buildWelcomeCredentialsMail({
        email: user.email,
        fullName,
        temporaryPassword,
        loginUrl: `${appUrl}/login`,
        includeLogo: Boolean(logo),
      });
      await this.mailService.sendMail({
        to: user.email,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        ...(logo ? { attachments: [logo] } : {}),
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo enviar correo de credenciales a ${user.email} (usuario ya creado): ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    }
  }

  async update(id: number, dto: UpdateUserDto, actorId?: number): Promise<UserPublicView> {
    const user = await this.getByIdOrFail(id);
    const before = toUserPublicView(user) as unknown as Record<string, unknown>;
    const deactivationReason = (dto.reason ?? dto.deactivationReason)?.trim();

    if (dto.status === UserStatus.INACTIVE && user.status !== UserStatus.INACTIVE) {
      if (!deactivationReason) {
        throw new BadRequestException(
          'El motivo de baja es obligatorio al inactivar un usuario.',
        );
      }
    }

    if (dto.groupId !== undefined) {
      const effectiveStatus = dto.status ?? user.status;
      const previewRoles =
        dto.roleIds !== undefined ? await this.resolveRoles(dto.roleIds) : (user.roles ?? []);
      this.assertGroupIdAllowed(previewRoles, effectiveStatus, dto.groupId);
      const existingEnrollment = await this.groupEnrollments.findOne({
        where: { userId: id, status: GroupEnrollmentStatus.ACTIVE },
      });
      if (existingEnrollment && existingEnrollment.groupId !== dto.groupId) {
        throw new BadRequestException(
          'El traslado de sección se gestiona en Estructura académica.',
        );
      }
    }

    if (dto.nationalId || dto.national_id) {
      const nationalId = (dto.nationalId || dto.national_id)!.replace(/-/g, '').trim();
      await this.ensureUniqueNationalId(nationalId, id);
      user.national_id = nationalId;
      user.nationalId = nationalId;
    }

    if (dto.email) {
      const email = dto.email.trim().toLowerCase();
      await this.ensureUniqueEmail(email, id);
      user.email = email;
    }

    if (dto.name !== undefined) {
      user.name = dto.name.trim();
    }
    if (dto.first_lastname !== undefined) {
      user.first_lastname = dto.first_lastname.trim();
    }
    if (dto.second_lastname !== undefined) {
      user.second_lastname = dto.second_lastname?.trim() || null;
    }
    if (dto.phone !== undefined) {
      user.phone = dto.phone?.trim() || null;
    }
    if (dto.status !== undefined) {
      user.status = dto.status;
    }
    if (dto.password) {
      const hashed = await bcrypt.hash(dto.password, 10);
      user.password_hash = hashed;
      user.passwordHash = hashed;
    }

    const saved = await this.repository.save(user);

    let rolesForProfile = user.roles ?? [];
    if (dto.roleIds !== undefined) {
      const roles = await this.resolveRoles(dto.roleIds);
      await this.repository.replaceRoles(saved.id, roles);
      rolesForProfile = roles;
    }

    if (dto.roleIds !== undefined || dto.departmentId !== undefined) {
      await this.syncTeacherProfile(saved.id, rolesForProfile, dto.departmentId);
    }

    const persisted = (await this.repository.findById(saved.id)) ?? saved;

    if (dto.groupId !== undefined) {
      await this.assignEnrollmentOnUpdate({
        userId: persisted.id,
        roles: rolesForProfile,
        status: persisted.status,
        groupId: dto.groupId,
      });
    }

    const after = toUserPublicView(persisted);
    const afterAudit: Record<string, unknown> = {
      ...(after as unknown as Record<string, unknown>),
    };
    if (deactivationReason && dto.status === UserStatus.INACTIVE) {
      afterAudit.deactivationReason = deactivationReason;
    }
    if (dto.groupId !== undefined) {
      afterAudit.groupId = dto.groupId;
    }

    await this.auditLogService.record({
      actorId: actorId ?? null,
      action: 'USER_UPDATED',
      entity: 'User',
      entityId: String(saved.id),
      before,
      after: afterAudit,
    });

    return this.withEnrollment(after, saved.id);
  }

  async createGuideTeacher(dto: CreateGuideTeacherDto): Promise<UserPublicView> {
    const teacherRole = await this.getTeacherRole();

    return this.create({
      nationalId: dto.nationalId,
      name: dto.name,
      first_lastname: dto.first_lastname,
      second_lastname: dto.second_lastname,
      email: dto.email,
      phone: dto.phone,
      roleIds: [teacherRole.id],
      departmentId: dto.departmentId,
    });
  }

  async updateGuideTeacher(
    id: number,
    dto: UpdateGuideTeacherDto,
    actorId?: number,
  ): Promise<UserPublicView> {
    await this.getGuideTeacherOrFail(id);
    return this.update(
      id,
      {
        nationalId: dto.nationalId,
        name: dto.name,
        first_lastname: dto.first_lastname,
        second_lastname: dto.second_lastname,
        email: dto.email,
        phone: dto.phone,
        departmentId: dto.departmentId,
      },
      actorId,
    );
  }

  async removeGuideTeacher(id: number, actorId?: number): Promise<UserPublicView> {
    const user = await this.getGuideTeacherOrFail(id);
    if (user.roles.some((role) => role.name === INSTITUTIONAL_ROLE_ADMIN)) {
      throw new BadRequestException('No se puede eliminar un administrador desde docentes guía.');
    }

    await this.teachingAssignments.update(
      { userId: id, isGuideTeacher: true },
      { isGuideTeacher: false },
    );

    return this.update(id, { status: UserStatus.INACTIVE, reason: 'Inactivación desde docentes guía' }, actorId);
  }

  private async getTeacherRole() {
    const role = await this.rolesRepository.findByName(INSTITUTIONAL_ROLE_TEACHER);
    if (!role) {
      throw new NotFoundException('El rol Docente no está configurado.');
    }
    return role;
  }

  private async getGuideTeacherOrFail(id: number): Promise<User> {
    const user = await this.getByIdOrFail(id);
    const isTeacher = user.roles.some((role) => role.name === INSTITUTIONAL_ROLE_TEACHER);
    if (!isTeacher) {
      throw new NotFoundException(`Guide teacher ${id} not found`);
    }
    return user;
  }

  private async getByIdOrFail(id: number): Promise<User> {
    const user = await this.repository.findById(id);
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  private costaRicaToday(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' });
  }

  private async findOwnEnrollment(userId: number): Promise<OwnEnrollmentView | null> {
    const today = this.costaRicaToday();
    const row = await this.groupEnrollments
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.group', 'g')
      .leftJoinAndSelect('g.section', 's')
      .leftJoinAndSelect('g.specialty', 'sp')
      .leftJoinAndSelect('e.academicPeriod', 'p')
      .where('e.id_users = :userId', { userId })
      .andWhere('e.starts_on <= :today', { today })
      .andWhere('(e.ends_on IS NULL OR e.ends_on >= :today)', { today })
      .orderBy('e.starts_on', 'DESC')
      .addOrderBy('e.id', 'DESC')
      .getOne();

    if (!row) return null;

    const groupName = row.group?.name ?? null;
    return {
      groupId: row.groupId,
      groupName,
      sectionLabel: composeOwnSectionLabel(row.group?.section?.gradeLevel, groupName),
      specialtyName: row.group?.specialty?.name ?? null,
      academicPeriodId: row.academicPeriodId,
      academicPeriodName: row.academicPeriod?.name ?? null,
      startsOn: String(row.startsOn).slice(0, 10),
      status: row.status,
    };
  }

  private async ensureUniqueNationalId(nationalId: string, excludeId?: number): Promise<void> {
    const existing = await this.repository.findByNationalId(nationalId, excludeId);
    if (existing) {
      throw new ConflictException(`Ya existe un usuario con la cédula ${nationalId}`);
    }
  }

  private async ensureUniqueEmail(email: string, excludeId?: number): Promise<void> {
    const existing = await this.repository.findByEmail(email, excludeId);
    if (existing) {
      throw new ConflictException(`Ya existe un usuario con el correo ${email}`);
    }
  }

  private async resolveRoles(roleIds?: number[]) {
    if (!roleIds?.length) {
      throw new BadRequestException('Debe asignar al menos un rol');
    }

    const roles = await Promise.all(roleIds.map((roleId) => this.rolesRepository.findById(roleId)));

    const missing = roleIds.filter((roleId, index) => !roles[index]);
    if (missing.length) {
      throw new NotFoundException(`Roles not found: ${missing.join(', ')}`);
    }

    return roles.filter((role) => role !== null);
  }

  private hasTeacherRole(roles: Array<Pick<RoleEntity, 'name'>>): boolean {
    return roles.some((role) => role.name === INSTITUTIONAL_ROLE_TEACHER);
  }

  private hasStudentRole(roles: Array<Pick<RoleEntity, 'name'>>): boolean {
    return roles.some((role) => role.name === INSTITUTIONAL_ROLE_STUDENT);
  }

  private async syncTeacherProfile(
    userId: number,
    roles: Array<Pick<RoleEntity, 'name'>>,
    departmentId?: number | null,
  ): Promise<void> {
    const isTeacher = this.hasTeacherRole(roles);
    const existing = await this.teacherProfiles.findOne({ where: { userId } });

    if (!isTeacher) {
      if (existing) {
        await this.teacherProfiles.delete({ userId });
      }
      return;
    }

    const resolvedDepartmentId = departmentId ?? existing?.departmentId;
    if (!resolvedDepartmentId) {
      throw new BadRequestException(
        'El departamento es obligatorio para usuarios con rol Docente.',
      );
    }

    await this.departmentsService.getByIdOrFail(resolvedDepartmentId);

    if (existing) {
      existing.departmentId = resolvedDepartmentId;
      await this.teacherProfiles.save(existing);
      return;
    }

    await this.teacherProfiles.save(
      this.teacherProfiles.create({
        userId,
        departmentId: resolvedDepartmentId,
      }),
    );
  }
}
