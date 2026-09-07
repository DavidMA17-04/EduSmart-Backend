import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import {
  INSTITUTIONAL_ROLE_ADMIN,
  INSTITUTIONAL_ROLE_TEACHER,
} from '../../../../common/constants/institutional-roles.constant';
import { UserStatus } from '../../../../common/enums/user-status.enum';
import { RolesRepository } from '../../roles/repositories/roles.repository';
import { TeachingAssignment } from '../../teaching-assignments/entities/teaching-assignment.entity';
import { CreateGuideTeacherDto } from '../dto/create-guide-teacher.dto';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateGuideTeacherDto } from '../dto/update-guide-teacher.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { User } from '../entities/user.entity';
import { toUserPublicView, UserPublicView } from '../mappers/user-public.mapper';
import { UsersRepository } from '../repositories/users.repository';
import { AuditLogService } from './audit-log.service';

const USER_AUDIT_ENTITY = 'User';
const USER_AUDIT_CREATED = 'USER_CREATED';
const USER_AUDIT_UPDATED = 'USER_UPDATED';
const USER_AUDIT_STATUS_CHANGED = 'USER_STATUS_CHANGED';

function normalizeAuditText(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function canonicalizeAuditRoles(roles: unknown): string {
  if (!Array.isArray(roles)) {
    return '[]';
  }

  const normalized = roles
    .map((role) => {
      if (!role || typeof role !== 'object') {
        return { id: 0, name: '', status: '' };
      }
      const item = role as { id?: number; name?: string; status?: string };
      return {
        id: item.id ?? 0,
        name: item.name ?? '',
        status: String(item.status ?? ''),
      };
    })
    .sort((left, right) => left.id - right.id || left.name.localeCompare(right.name));

  return JSON.stringify(normalized);
}

function userFunctionalAuditSnapshot(view: Record<string, unknown>) {
  const nationalId = normalizeAuditText(view.nationalId ?? view.national_id)?.replace(
    /-/g,
    '',
  );

  return {
    nationalId: nationalId || null,
    name: normalizeAuditText(view.name),
    first_lastname: normalizeAuditText(view.first_lastname),
    second_lastname: normalizeAuditText(view.second_lastname),
    email: normalizeAuditText(view.email)?.toLowerCase() ?? null,
    phone: normalizeAuditText(view.phone),
    roles: canonicalizeAuditRoles(view.roles),
  };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly repository: UsersRepository,
    private readonly rolesRepository: RolesRepository,
    private readonly auditLogService: AuditLogService,
    @InjectRepository(TeachingAssignment)
    private readonly teachingAssignments: Repository<TeachingAssignment>,
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
    return toUserPublicView(await this.getByIdOrFail(id));
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
    const name = dto.name.trim();
    const firstLastName = dto.first_lastname.trim();
    const secondLastName = dto.second_lastname?.trim() || null;

    const password = dto.password?.trim();
    const passwordHash = password
      ? await bcrypt.hash(password, 10)
      : await bcrypt.hash(randomUUID(), 10);

    const user = this.repository.create({
      national_id: nationalId,
      nationalId: nationalId,
      name,
      first_lastname: firstLastName,
      second_lastname: secondLastName,
      email,
      phone: dto.phone?.trim() || null,
      status: dto.status ?? UserStatus.ACTIVE,
      password_hash: passwordHash,
      mustChangePassword: true,
    });

    const saved = await this.repository.save(user);
    await this.repository.replaceRoles(saved.id, roles);

    const persisted = (await this.repository.findById(saved.id)) ?? saved;
    const after = toUserPublicView(persisted);

    await this.recordUserAudit({
      actorId,
      action: USER_AUDIT_CREATED,
      entityId: saved.id,
      before: null,
      after,
    });

    return after;
  }

  async update(
    id: number,
    dto: UpdateUserDto,
    actorId?: number,
  ): Promise<UserPublicView> {
    const user = await this.getByIdOrFail(id);
    const before = toUserPublicView(user) as unknown as Record<string, unknown>;
    const previousPasswordHash = user.password_hash;

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

    if (dto.roleIds !== undefined) {
      const roles = await this.resolveRoles(dto.roleIds);
      await this.repository.replaceRoles(saved.id, roles);
    }

    const persisted = (await this.repository.findById(saved.id)) ?? saved;
    const after = toUserPublicView(persisted);
    const passwordChanged = persisted.password_hash !== previousPasswordHash;

    await this.recordUserAudit({
      actorId,
      action: this.resolveUserUpdateAuditAction(before, after, passwordChanged),
      entityId: saved.id,
      before,
      after,
    });

    return after;
  }

  async createGuideTeacher(
    dto: CreateGuideTeacherDto,
    actorId?: number,
  ): Promise<UserPublicView> {
    const teacherRole = await this.getTeacherRole();

    return this.create(
      {
        nationalId: dto.nationalId,
        name: dto.name,
        first_lastname: dto.first_lastname,
        second_lastname: dto.second_lastname,
        email: dto.email,
        phone: dto.phone,
        roleIds: [teacherRole.id],
      },
      actorId,
    );
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
      },
      actorId,
    );
  }

  async removeGuideTeacher(id: number, actorId?: number): Promise<UserPublicView> {
    const user = await this.getGuideTeacherOrFail(id);
    if (user.roles.some((role) => role.name === INSTITUTIONAL_ROLE_ADMIN)) {
      throw new BadRequestException(
        'No se puede eliminar un administrador desde docentes guía.',
      );
    }

    await this.teachingAssignments.update(
      { userId: id, isGuideTeacher: true },
      { isGuideTeacher: false },
    );

    return this.update(
      id,
      { status: UserStatus.INACTIVE },
      actorId,
    );
  }

  private resolveUserUpdateAuditAction(
    before: Record<string, unknown>,
    after: UserPublicView,
    passwordChanged: boolean,
  ): typeof USER_AUDIT_STATUS_CHANGED | typeof USER_AUDIT_UPDATED {
    const afterView = after as unknown as Record<string, unknown>;
    const statusChanged = before.status !== after.status;
    const otherFunctionalChanged =
      passwordChanged ||
      JSON.stringify(userFunctionalAuditSnapshot(before)) !==
        JSON.stringify(userFunctionalAuditSnapshot(afterView));

    if (statusChanged && !otherFunctionalChanged) {
      return USER_AUDIT_STATUS_CHANGED;
    }

    return USER_AUDIT_UPDATED;
  }

  private recordUserAudit(entry: {
    actorId?: number | null;
    action: string;
    entityId: number;
    before: UserPublicView | Record<string, unknown> | null;
    after: UserPublicView;
  }) {
    return this.auditLogService.record({
      actorId: entry.actorId ?? null,
      action: entry.action,
      entity: USER_AUDIT_ENTITY,
      entityId: String(entry.entityId),
      before: (entry.before ?? null) as Record<string, unknown> | null,
      after: entry.after as unknown as Record<string, unknown>,
    });
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
    const isTeacher = user.roles.some(
      (role) => role.name === INSTITUTIONAL_ROLE_TEACHER,
    );
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

  private async ensureUniqueNationalId(
    nationalId: string,
    excludeId?: number,
  ): Promise<void> {
    const existing = await this.repository.findByNationalId(nationalId, excludeId);
    if (existing) {
      throw new ConflictException(
        `Ya existe un usuario con la cédula ${nationalId}`,
      );
    }
  }

  private async ensureUniqueEmail(
    email: string,
    excludeId?: number,
  ): Promise<void> {
    const existing = await this.repository.findByEmail(email, excludeId);
    if (existing) {
      throw new ConflictException(`Ya existe un usuario con el correo ${email}`);
    }
  }

  private async resolveRoles(roleIds?: number[]) {
    if (!roleIds?.length) {
      throw new BadRequestException('Debe asignar al menos un rol');
    }

    const roles = await Promise.all(
      roleIds.map((roleId) => this.rolesRepository.findById(roleId)),
    );

    const missing = roleIds.filter((roleId, index) => !roles[index]);
    if (missing.length) {
      throw new NotFoundException(`Roles not found: ${missing.join(', ')}`);
    }

    return roles.filter((role) => role !== null);
  }
}
