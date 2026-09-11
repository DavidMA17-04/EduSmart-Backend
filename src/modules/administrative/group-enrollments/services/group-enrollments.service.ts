import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { INSTITUTIONAL_ROLE_STUDENT } from '../../../../common/constants/institutional-roles.constant';
import { GroupEnrollmentStatus } from '../../../../common/enums/group-enrollment-status.enum';
import { RoleStatus } from '../../../../common/enums/role-status.enum';
import { UserStatus } from '../../../../common/enums/user-status.enum';
import { GroupEntity } from '../../sections/entities/group.entity';
import { User } from '../../users/entities/user.entity';
import { CreateGroupEnrollmentDto } from '../dto/create-group-enrollment.dto';
import { TransferGroupEnrollmentDto } from '../dto/transfer-group-enrollment.dto';
import { GroupEnrollment } from '../entities/group-enrollment.entity';

@Injectable()
export class GroupEnrollmentsService {
  constructor(
    @InjectRepository(GroupEnrollment)
    private readonly repository: Repository<GroupEnrollment>,
    @InjectRepository(GroupEntity)
    private readonly groups: Repository<GroupEntity>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create enrollment under a per-student pessimistic lock (users row FOR UPDATE).
   */
  async create(dto: CreateGroupEnrollmentDto): Promise<GroupEnrollment> {
    const startsOn = dto.startsOn.slice(0, 10);
    const endsOn = dto.endsOn ? dto.endsOn.slice(0, 10) : null;
    this.assertDateRange(startsOn, endsOn);

    return this.dataSource.transaction(async (manager) => {
      await this.lockStudentUser(manager, dto.userId);
      const group = await this.requireGroup(manager, dto.groupId);
      const academicPeriodId = dto.academicPeriodId ?? group.academicPeriodId;

      await this.assertNoOverlap(manager, {
        userId: dto.userId,
        academicPeriodId,
        startsOn,
        endsOn,
      });

      const repo = manager.getRepository(GroupEnrollment);
      return repo.save(
        repo.create({
          userId: dto.userId,
          groupId: group.id,
          academicPeriodId,
          startsOn,
          endsOn,
          status: endsOn
            ? GroupEnrollmentStatus.ENDED
            : GroupEnrollmentStatus.ACTIVE,
        }),
      );
    });
  }

  /**
   * Transfer: lock student → close previous → open new (atomic).
   */
  async transfer(dto: TransferGroupEnrollmentDto): Promise<{
    closed: GroupEnrollment | null;
    opened: GroupEnrollment;
  }> {
    const effectiveOn = dto.effectiveOn.slice(0, 10);

    return this.dataSource.transaction(async (manager) => {
      await this.lockStudentUser(manager, dto.userId);
      const newGroup = await this.requireGroup(manager, dto.newGroupId);
      const academicPeriodId =
        dto.academicPeriodId ?? newGroup.academicPeriodId;

      const repo = manager.getRepository(GroupEnrollment);
      const active = await repo
        .createQueryBuilder('e')
        .setLock('pessimistic_write')
        .where('e.id_users = :userId', { userId: dto.userId })
        .andWhere('e.status = :status', {
          status: GroupEnrollmentStatus.ACTIVE,
        })
        .andWhere('e.ends_on IS NULL')
        .orderBy('e.starts_on', 'DESC')
        .getOne();

      let closed: GroupEnrollment | null = null;
      if (active) {
        if (active.groupId === newGroup.id) {
          throw new ConflictException(
            'Student is already enrolled in the target group',
          );
        }
        const endsOn = this.dayBefore(effectiveOn);
        if (endsOn < active.startsOn) {
          throw new BadRequestException(
            'Transfer date must be after the current enrollment start',
          );
        }
        active.endsOn = endsOn;
        active.status = GroupEnrollmentStatus.ENDED;
        closed = await repo.save(active);
      }

      await this.assertNoOverlap(manager, {
        userId: dto.userId,
        academicPeriodId,
        startsOn: effectiveOn,
        endsOn: null,
        excludeId: closed?.id,
      });

      const opened = await repo.save(
        repo.create({
          userId: dto.userId,
          groupId: newGroup.id,
          academicPeriodId,
          startsOn: effectiveOn,
          endsOn: null,
          status: GroupEnrollmentStatus.ACTIVE,
        }),
      );

      return { closed, opened };
    });
  }

  async findGroupAsOf(
    userId: number,
    asOfDate: string,
    academicPeriodId?: number,
  ): Promise<GroupEnrollment | null> {
    if (!Number.isInteger(userId) || userId < 1) {
      throw new BadRequestException('userId must be a positive integer');
    }
    const day = String(asOfDate).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(`${day}T12:00:00.000Z`))) {
      throw new BadRequestException('date must be a valid YYYY-MM-DD value');
    }

    const qb = this.repository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.group', 'g')
      .where('e.id_users = :userId', { userId })
      .andWhere('e.starts_on <= :day', { day })
      .andWhere('(e.ends_on IS NULL OR e.ends_on >= :day)', { day });

    if (academicPeriodId != null) {
      if (!Number.isInteger(academicPeriodId) || academicPeriodId < 1) {
        throw new BadRequestException(
          'academicPeriodId must be a positive integer',
        );
      }
      qb.andWhere('e.id_academic_periods = :periodId', {
        periodId: academicPeriodId,
      });
    }

    return qb.orderBy('e.starts_on', 'DESC').getOne();
  }

  /**
   * Latest enrollment for a student in a given academic period (historical OK).
   * Does NOT require status=ACTIVE — ENDED rows for that period are eligible.
   * Deterministic: starts_on DESC, then id DESC.
   */
  async findLatestForPeriod(
    userId: number,
    academicPeriodId: number,
  ): Promise<GroupEnrollment | null> {
    if (!Number.isInteger(userId) || userId < 1) {
      throw new BadRequestException('userId must be a positive integer');
    }
    if (!Number.isInteger(academicPeriodId) || academicPeriodId < 1) {
      throw new BadRequestException(
        'academicPeriodId must be a positive integer',
      );
    }

    return this.repository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.group', 'g')
      .where('e.id_users = :userId', { userId })
      .andWhere('e.id_academic_periods = :periodId', {
        periodId: academicPeriodId,
      })
      .orderBy('e.starts_on', 'DESC')
      .addOrderBy('e.id', 'DESC')
      .getOne();
  }

  /**
   * Lock the student user row so concurrent create/transfer for the same
   * student serialize even when no group_enrollments row exists yet.
   */
  private async lockStudentUser(
    manager: EntityManager,
    userId: number,
  ): Promise<User> {
    const user = await manager.findOne(User, {
      where: { id: userId },
      relations: { userRoles: { role: true } },
      lock: { mode: 'pessimistic_write' },
    });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    if (user.status !== UserStatus.ACTIVE) {
      throw new BadRequestException('Student user must be ACTIVE');
    }
    const isStudent = (user.userRoles ?? []).some(
      (row) =>
        row.role?.status === RoleStatus.ACTIVE &&
        row.role.name === INSTITUTIONAL_ROLE_STUDENT,
    );
    if (!isStudent) {
      throw new BadRequestException('User must have Estudiante role');
    }
    return user;
  }

  private async requireGroup(
    manager: EntityManager,
    groupId: number,
  ): Promise<GroupEntity> {
    const group = await manager.findOne(GroupEntity, { where: { id: groupId } });
    if (!group) throw new NotFoundException(`Group ${groupId} not found`);
    return group;
  }

  private assertDateRange(startsOn: string, endsOn: string | null): void {
    if (endsOn && endsOn < startsOn) {
      throw new BadRequestException('endsOn must be >= startsOn');
    }
  }

  private dayBefore(isoDate: string): string {
    const d = new Date(`${isoDate}T12:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  private async assertNoOverlap(
    manager: EntityManager,
    input: {
      userId: number;
      academicPeriodId: number;
      startsOn: string;
      endsOn: string | null;
      excludeId?: number;
    },
  ): Promise<void> {
    const repo = manager.getRepository(GroupEnrollment);
    const end = input.endsOn ?? '9999-12-31';
    const qb = repo
      .createQueryBuilder('e')
      .where('e.id_users = :userId', { userId: input.userId })
      .andWhere('e.id_academic_periods = :periodId', {
        periodId: input.academicPeriodId,
      })
      .andWhere('e.starts_on <= :end', { end })
      .andWhere('(e.ends_on IS NULL OR e.ends_on >= :start)', {
        start: input.startsOn,
      });

    if (input.excludeId) {
      qb.andWhere('e.id_group_enrollments <> :excludeId', {
        excludeId: input.excludeId,
      });
    }

    const clash = await qb.getOne();
    if (clash) {
      throw new ConflictException({
        code: 'GROUP_ENROLLMENT_OVERLAP',
        message:
          'Enrollment date range overlaps an existing enrollment for this student and period',
      });
    }
  }
}
