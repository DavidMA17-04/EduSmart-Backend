import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserStatus } from '../../../../common/enums/user-status.enum';
import { AuthRepository } from '../../../auth/repositories/auth.repository';
import { RolesRepository } from '../../roles/repositories/roles.repository';
import { CreateUserDto } from '../dto/create-user.dto';
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
    private readonly authRepository: AuthRepository,
  ) {}

  async findAll(): Promise<UserPublicView[]> {
    const users = await this.repository.findAll();
    return users.map(toUserPublicView);
  }

  async findGuideTeachers(): Promise<UserPublicView[]> {
    const users = await this.repository.findGuideTeachers();
    return users.map(toUserPublicView);
  }

  async findOne(id: string): Promise<UserPublicView> {
    return toUserPublicView(await this.getByIdOrFail(id));
  }

  async create(dto: CreateUserDto): Promise<UserPublicView> {
    const nationalId = dto.nationalId.replace(/-/g, '').trim();
    const email = dto.email.trim().toLowerCase();

    await this.ensureUniqueNationalId(nationalId);
    await this.ensureUniqueEmail(email);

    const password = dto.password?.trim();
    if (password) {
      await this.ensureUniqueAuthEmail(email);
    }

    const roles = await this.resolveRoles(dto.roleIds);
    const firstName = dto.name?.trim() || dto.firstName?.trim() || '';
    const firstLastName = dto.first_lastname?.trim() || dto.lastName?.trim() || '';
    const secondLastName = dto.second_lastname?.trim() || null;

    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    const user = this.repository.create({
      national_id: nationalId,
      name: firstName,
      first_lastname: firstLastName,
      second_lastname: secondLastName,
      email,
      phone: dto.phone?.trim() || null,
      status: dto.status ?? UserStatus.ACTIVE,
      password_hash: passwordHash,
      roles,
    });

    const saved = await this.repository.save(user);

    if (password && passwordHash) {
      await this.authRepository.createUser({
        email,
        name: `${firstName} ${firstLastName}`.trim(),
        passwordHash,
      });
    }

    const persisted = (await this.repository.findById(saved.id)) ?? saved;
    return toUserPublicView(persisted);
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    actorId?: string,
  ): Promise<UserPublicView> {
    const user = await this.getByIdOrFail(id);
    const before = toUserPublicView(user) as unknown as Record<string, unknown>;

    if (dto.nationalId) {
      const nationalId = dto.nationalId.replace(/-/g, '').trim();
      await this.ensureUniqueNationalId(nationalId, id);
      user.national_id = nationalId;
    }

    if (dto.email) {
      const email = dto.email.trim().toLowerCase();
      await this.ensureUniqueEmail(email, id);
      user.email = email;
    }

    if (dto.name !== undefined || dto.firstName !== undefined) {
      user.name = (dto.name || dto.firstName)?.trim();
    }
    if (dto.first_lastname !== undefined || dto.lastName !== undefined) {
      user.first_lastname = (dto.first_lastname || dto.lastName)?.trim();
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
      user.password_hash = await bcrypt.hash(dto.password, 10);
    }
    if (dto.roleIds !== undefined) {
      user.roles = await this.resolveRoles(dto.roleIds);
    }

    const saved = await this.repository.save(user);
    const persisted = (await this.repository.findById(saved.id)) ?? saved;
    const after = toUserPublicView(persisted);

    await this.auditLogService.record({
      actorId: actorId ?? null,
      action: 'USER_UPDATED',
      entity: 'User',
      entityId: String(saved.id ?? (saved as any).id_users),
      before,
      after: after as unknown as Record<string, unknown>,
    });

    return after;
  }

  private async getByIdOrFail(id: string): Promise<User> {
    const user = await this.repository.findById(id);
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  private async ensureUniqueNationalId(
    nationalId: string,
    excludeId?: string,
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
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.repository.findByEmail(email, excludeId);
    if (existing) {
      throw new ConflictException(`Ya existe un usuario con el correo ${email}`);
    }
  }

  private async ensureUniqueAuthEmail(email: string): Promise<void> {
    const existing = await this.authRepository.findByEmail(email);
    if (existing) {
      throw new ConflictException(
        `Ya existe una cuenta de acceso con el correo ${email}`,
      );
    }
  }

  private async resolveRoles(roleIds?: string[]) {
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
