import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Role } from '../../../../common/enums/role.enum';
import { institutionalRoleMatches } from '../../../../common/utils/institutional-role-match.util';
import { GuardianStudentLink } from '../../../attendance/entities/guardian-student-link.entity';
import { displayUserName } from '../mappers/user-public.mapper';
import { UsersRepository } from '../repositories/users.repository';
import { User } from '../entities/user.entity';

export type GuardianLinkPersonView = {
  id: number;
  nationalId: string | null;
  name: string;
  first_lastname: string | null;
  second_lastname: string | null;
  email: string | null;
  status: User['status'];
};

export type GuardianStudentLinkView = {
  id: number;
  guardianUserId: number;
  studentUserId: number;
  relationship: string | null;
  createdAt: Date;
  guardian: GuardianLinkPersonView;
  student: GuardianLinkPersonView;
};

@Injectable()
export class GuardianStudentLinksService {
  constructor(
    @InjectRepository(GuardianStudentLink)
    private readonly links: Repository<GuardianStudentLink>,
    private readonly users: UsersRepository,
  ) {}

  async create(anchorUserId: number, counterpartUserId: number, relationship?: string | null) {
    if (anchorUserId === counterpartUserId) {
      throw new BadRequestException('El encargado y el estudiante deben ser usuarios distintos.');
    }

    const [anchor, counterpart] = await Promise.all([
      this.users.findById(anchorUserId),
      this.users.findById(counterpartUserId),
    ]);
    if (!anchor || !counterpart) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    const pair = this.resolvePair(anchor, counterpart);
    const normalizedRelationship = relationship?.trim() ? relationship.trim().slice(0, 50) : null;

    const existing = await this.links.findOne({
      where: { guardianUserId: pair.guardian.id, studentUserId: pair.student.id },
    });
    if (existing) {
      throw new ConflictException('Este encargado ya está vinculado con este estudiante.');
    }

    try {
      const saved = await this.links.save(
        this.links.create({
          guardianUserId: pair.guardian.id,
          studentUserId: pair.student.id,
          relationship: normalizedRelationship,
        }),
      );
      return this.toView(await this.requireById(saved.id));
    } catch (error) {
      if (isDuplicateLinkError(error)) {
        throw new ConflictException('Este encargado ya está vinculado con este estudiante.');
      }
      throw error;
    }
  }

  async listForUser(userId: number): Promise<GuardianStudentLinkView[]> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    const rows = await this.links.find({
      where: [{ guardianUserId: userId }, { studentUserId: userId }],
      relations: {
        guardian: { userRoles: { role: true } },
        student: { userRoles: { role: true } },
      },
      order: { id: 'ASC' },
    });
    return rows.map((row) => this.toView(row));
  }

  async remove(linkId: number): Promise<void> {
    const link = await this.links.findOne({ where: { id: linkId } });
    if (!link) {
      throw new NotFoundException('Vínculo no encontrado.');
    }
    await this.links.remove(link);
  }

  private async requireById(id: number): Promise<GuardianStudentLink> {
    const link = await this.links.findOne({
      where: { id },
      relations: {
        guardian: { userRoles: { role: true } },
        student: { userRoles: { role: true } },
      },
    });
    if (!link) {
      throw new NotFoundException('Vínculo no encontrado.');
    }
    return link;
  }

  private resolvePair(anchor: User, counterpart: User): { guardian: User; student: User } {
    const anchorGuardian = isGuardian(anchor);
    const anchorStudent = isStudent(anchor);
    const counterpartGuardian = isGuardian(counterpart);
    const counterpartStudent = isStudent(counterpart);

    const asStudentAnchor = anchorStudent && counterpartGuardian;
    const asGuardianAnchor = anchorGuardian && counterpartStudent;

    if (asStudentAnchor && !asGuardianAnchor) {
      return { student: anchor, guardian: counterpart };
    }
    if (asGuardianAnchor && !asStudentAnchor) {
      return { guardian: anchor, student: counterpart };
    }
    throw new BadRequestException('El vínculo debe ser entre un Encargado y un Estudiante.');
  }

  private toView(link: GuardianStudentLink): GuardianStudentLinkView {
    return {
      id: link.id,
      guardianUserId: link.guardianUserId,
      studentUserId: link.studentUserId,
      relationship: link.relationship ?? null,
      createdAt: link.createdAt,
      guardian: toPersonView(link.guardian),
      student: toPersonView(link.student),
    };
  }
}

function roleNames(user: User): string[] {
  return (user.roles ?? []).map((role) => role.name).filter(Boolean);
}

function isGuardian(user: User): boolean {
  return institutionalRoleMatches(roleNames(user), [Role.GUARDIAN]);
}

function isStudent(user: User): boolean {
  return institutionalRoleMatches(roleNames(user), [Role.STUDENT]);
}

function toPersonView(user: User | undefined): GuardianLinkPersonView {
  if (!user) {
    return {
      id: 0,
      nationalId: null,
      name: '',
      first_lastname: null,
      second_lastname: null,
      email: null,
      status: 'ACTIVE' as User['status'],
    };
  }
  return {
    id: user.id,
    nationalId: user.nationalId ?? user.national_id ?? null,
    name: displayUserName(user),
    first_lastname: user.first_lastname ?? null,
    second_lastname: user.second_lastname ?? null,
    email: user.email ?? null,
    status: user.status,
  };
}

function isDuplicateLinkError(error: unknown): boolean {
  if (error instanceof QueryFailedError) {
    const driverError = (error as QueryFailedError & { driverError?: { code?: string; errno?: number } })
      .driverError;
    if (driverError?.code === 'ER_DUP_ENTRY' || driverError?.errno === 1062) return true;
  }
  const raw = error as { code?: string; errno?: number };
  return raw?.code === 'ER_DUP_ENTRY' || raw?.errno === 1062;
}
