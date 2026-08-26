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

  async findGuideTeachers(): Promise<UserPublicView[]> {
    const users = await this.repository.findGuideTeachers();
    return users.map(toUserPublicView);
  }

  async findOne(id: number): Promise<UserPublicView> {
    return toUserPublicView(await this.getByIdOrFail(id));
  }

  async create(dto: CreateUserDto): Promise<UserPublicView> {
    const nationalId = dto.nationalId.replace(/-/g, '').trim();
    const email = dto.email.trim().toLowerCase();

    await this.ensureUniqueNationalId(nationalId);
    await this.ensureUniqueEmail(email);

    const roles = await this.resolveRoles(dto.roleIds);
    const displayName =
      dto.name?.trim() || `${dto.firstName.trim()} ${dto.lastName.trim()}`;

    const password = dto.password?.trim();
    const passwordHash = password
      ? await bcrypt.hash(password, 10)
      : await bcrypt.hash(randomUUID(), 10);

    const user = this.repository.create({
      nationalId,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      email,
      phone: dto.phone?.trim() || null,
      name: displayName,
      status: dto.status ?? UserStatus.ACTIVE,
      passwordHash,
      mustChangePassword: true,
    });

    const saved = await this.repository.save(user);
    await this.repository.replaceRoles(saved.id, roles);

    const persisted = (await this.repository.findById(saved.id)) ?? saved;
    return toUserPublicView(persisted);
  }

  async update(
    id: number,
    dto: UpdateUserDto,
    actorId?: number,
  ): Promise<UserPublicView> {
    const user = await this.getByIdOrFail(id);
    const before = toUserPublicView(user) as unknown as Record<string, unknown>;

    if (dto.nationalId) {
      const nationalId = dto.nationalId.replace(/-/g, '').trim();
      await this.ensureUniqueNationalId(nationalId, id);
      user.nationalId = nationalId;
    }

    if (dto.email) {
      const email = dto.email.trim().toLowerCase();
      await this.ensureUniqueEmail(email, id);
      user.email = email;
    }

    if (dto.firstName !== undefined) {
      user.firstName = dto.firstName.trim();
    }
    if (dto.lastName !== undefined) {
      user.lastName = dto.lastName.trim();
    }
    if (dto.phone !== undefined) {
      user.phone = dto.phone?.trim() || null;
    }
    if (dto.status !== undefined) {
      user.status = dto.status;
    }
    if (dto.password) {
      user.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    user.name =
      dto.name?.trim() ||
      [user.firstName, user.lastName].filter(Boolean).join(' ') ||
      user.name;

    const saved = await this.repository.save(user);

    if (dto.roleIds !== undefined) {
      const roles = await this.resolveRoles(dto.roleIds);
      await this.repository.replaceRoles(saved.id, roles);
    }

    const persisted = (await this.repository.findById(saved.id)) ?? saved;
    const after = toUserPublicView(persisted);

    await this.auditLogService.record({
      actorId: actorId ?? null,
      action: 'USER_UPDATED',
      entity: 'User',
      entityId: String(saved.id),
      before,
      after: after as unknown as Record<string, unknown>,
    });

    return after;
  }

  async createGuideTeacher(dto: CreateGuideTeacherDto): Promise<UserPublicView> {
    const teacherRole = await this.getTeacherRole();
    return this.create({ ...dto, roleIds: [teacherRole.id] });
  }

  async updateGuideTeacher(
    id: number,
    dto: UpdateGuideTeacherDto,
    actorId?: number,
  ): Promise<UserPublicView> {
    await this.getGuideTeacherOrFail(id);
    return this.update(id, dto, actorId);
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
