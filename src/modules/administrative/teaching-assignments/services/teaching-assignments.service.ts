import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { AcademicOfferingKind } from '../../../../common/enums/academic-offering-kind.enum';
import { INSTITUTIONAL_ROLE_TEACHER } from '../../../../common/constants/institutional-roles.constant';
import { RoleStatus } from '../../../../common/enums/role-status.enum';
import { UserStatus } from '../../../../common/enums/user-status.enum';
import { AcademicOfferingEligibilityService } from '../../academic-offerings/services/academic-offering-eligibility.service';
import { GroupEntity } from '../../sections/entities/group.entity';
import { User } from '../../users/entities/user.entity';
import { CreateTeachingAssignmentDto } from '../dto/create-teaching-assignment.dto';
import { UpdateTeachingAssignmentDto } from '../dto/update-teaching-assignment.dto';
import { TeachingAssignment } from '../entities/teaching-assignment.entity';

@Injectable()
export class TeachingAssignmentsService {
  constructor(
    @InjectRepository(TeachingAssignment)
    private readonly repository: Repository<TeachingAssignment>,
    @InjectRepository(GroupEntity)
    private readonly groups: Repository<GroupEntity>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly eligibility: AcademicOfferingEligibilityService,
  ) {}

  async create(dto: CreateTeachingAssignmentDto): Promise<TeachingAssignment> {
    const group = await this.requireGroup(dto.groupId);
    await this.requireTeacher(dto.userId);

    const offering = await this.eligibility.resolveOffering({
      offeringKind: dto.offeringKind,
      subjectId: dto.subjectId,
      specialtyId: dto.specialtyId,
    });

    await this.eligibility.assertOfferingAllowedForGroup(
      group.id,
      offering.kind,
    );

    const academicPeriodId =
      dto.academicPeriodId ?? group.academicPeriodId ?? null;

    await this.assertNoDuplicate({
      userId: dto.userId,
      groupId: group.id,
      offeringKind: offering.kind,
      subjectId: offering.subjectId,
      specialtyId: offering.specialtyId,
      academicPeriodId,
    });

    try {
      const saved = await this.repository.save(
        this.repository.create({
          userId: dto.userId,
          groupId: group.id,
          academicPeriodId,
          offeringKind: offering.kind,
          subjectId: offering.subjectId,
          specialtyId: offering.specialtyId,
          isGuideTeacher: dto.isGuideTeacher ?? false,
        }),
      );
      return this.findOne(saved.id);
    } catch (error) {
      this.rethrowDuplicate(error);
      throw error;
    }
  }

  async update(
    id: number,
    dto: UpdateTeachingAssignmentDto,
  ): Promise<TeachingAssignment> {
    const assignment = await this.findOne(id);
    if (!assignment.offeringKind && (dto.offeringKind || dto.subjectId || dto.specialtyId)) {
      // promoting guide-only row to offering assignment
    }

    const offeringKind = dto.offeringKind ?? assignment.offeringKind;
    if (!offeringKind) {
      throw new BadRequestException(
        'Guide-only assignment cannot be updated without offeringKind',
      );
    }

    const subjectId =
      dto.subjectId !== undefined ? dto.subjectId : assignment.subjectId;
    const specialtyId =
      dto.specialtyId !== undefined ? dto.specialtyId : assignment.specialtyId;

    const offering = await this.eligibility.resolveOffering({
      offeringKind,
      subjectId,
      specialtyId,
    });

    await this.eligibility.assertOfferingAllowedForGroup(
      assignment.groupId,
      offering.kind,
    );

    const academicPeriodId =
      dto.academicPeriodId !== undefined
        ? dto.academicPeriodId
        : assignment.academicPeriodId ?? null;

    await this.assertNoDuplicate({
      userId: assignment.userId,
      groupId: assignment.groupId,
      offeringKind: offering.kind,
      subjectId: offering.subjectId,
      specialtyId: offering.specialtyId,
      academicPeriodId,
      excludeId: assignment.id,
    });

    assignment.offeringKind = offering.kind;
    assignment.subjectId = offering.subjectId;
    assignment.specialtyId = offering.specialtyId;
    assignment.academicPeriodId = academicPeriodId;
    if (dto.isGuideTeacher !== undefined) {
      assignment.isGuideTeacher = dto.isGuideTeacher;
    }

    try {
      await this.repository.save(assignment);
      return this.findOne(assignment.id);
    } catch (error) {
      this.rethrowDuplicate(error);
      throw error;
    }
  }

  async findOne(id: number): Promise<TeachingAssignment> {
    const row = await this.repository.findOne({
      where: { id },
      relations: {
        user: true,
        group: { section: true },
        subject: true,
        specialty: true,
        academicPeriod: true,
      },
    });
    if (!row) throw new NotFoundException(`TeachingAssignment ${id} not found`);
    return row;
  }

  /**
   * List impartible assignments only (offeringKind IS NOT NULL).
   * Optional filters: groupId, teacherId (userId), periodId.
   */
  async list(filters: {
    groupId?: number;
    teacherId?: number;
    periodId?: number;
  } = {}): Promise<TeachingAssignment[]> {
    const where: Record<string, unknown> = {
      offeringKind: Not(IsNull()),
    };
    if (filters.groupId != null) where.groupId = filters.groupId;
    if (filters.teacherId != null) where.userId = filters.teacherId;
    if (filters.periodId != null) where.academicPeriodId = filters.periodId;

    return this.repository.find({
      where: where as never,
      relations: {
        user: true,
        group: { section: true },
        subject: true,
        specialty: true,
        academicPeriod: true,
      },
      order: { id: 'ASC' },
    });
  }

  /** @deprecated Prefer list({ groupId }) — kept for callers expecting group-scoped list. */
  async findByGroup(groupId: number): Promise<TeachingAssignment[]> {
    return this.list({ groupId });
  }

  private async requireGroup(groupId: number): Promise<GroupEntity> {
    const group = await this.groups.findOne({
      where: { id: groupId },
      relations: { section: true },
    });
    if (!group) throw new NotFoundException(`Group ${groupId} not found`);
    return group;
  }

  private async requireTeacher(userId: number): Promise<User> {
    const user = await this.users.findOne({
      where: { id: userId },
      relations: { userRoles: { role: true } },
    });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    if (user.status !== UserStatus.ACTIVE) {
      throw new BadRequestException('Teacher user must be ACTIVE');
    }
    const isTeacher = (user.userRoles ?? []).some(
      (row) =>
        row.role?.status === RoleStatus.ACTIVE &&
        row.role.name === INSTITUTIONAL_ROLE_TEACHER,
    );
    if (!isTeacher) {
      throw new BadRequestException('User must have Docente role');
    }
    return user;
  }

  private async assertNoDuplicate(input: {
    userId: number;
    groupId: number;
    offeringKind: AcademicOfferingKind;
    subjectId: number | null;
    specialtyId: number | null;
    academicPeriodId: number | null;
    excludeId?: number;
  }): Promise<void> {
    const where: Record<string, unknown> = {
      userId: input.userId,
      groupId: input.groupId,
      offeringKind: input.offeringKind,
      subjectId: input.subjectId ?? IsNull(),
      specialtyId: input.specialtyId ?? IsNull(),
      academicPeriodId: input.academicPeriodId ?? IsNull(),
    };
    const existing = await this.repository.findOne({ where: where as never });
    if (existing && existing.id !== input.excludeId) {
      throw new ConflictException({
        code: 'TEACHING_ASSIGNMENT_DUPLICATE',
        message:
          'A teaching assignment already exists for this teacher, group, offering and period',
      });
    }
  }

  private rethrowDuplicate(error: unknown): void {
    const err = error as { code?: string; errno?: number };
    if (err?.code === 'ER_DUP_ENTRY' || err?.errno === 1062) {
      throw new ConflictException({
        code: 'TEACHING_ASSIGNMENT_DUPLICATE',
        message:
          'A teaching assignment already exists for this teacher, group, offering and period',
      });
    }
  }
}
