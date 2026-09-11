import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, QueryRunner, Repository } from 'typeorm';
import { calendarDateInTimeZone } from '../../../common/utils/business-calendar-date.util';
import { AcademicOfferingEligibilityService } from '../../administrative/academic-offerings/services/academic-offering-eligibility.service';
import { GroupEnrollmentsService } from '../../administrative/group-enrollments/services/group-enrollments.service';
import { TeachingAssignment } from '../../administrative/teaching-assignments/entities/teaching-assignment.entity';
import {
  isGuideOnlyAssignment,
  isImpartableTeachingAssignment,
} from '../../administrative/teaching-assignments/utils/assignment-offering.util';
import { AttendanceSession } from '../../attendance/entities/attendance-session.entity';
import { CreateScheduleEntryDto } from '../dto/create-schedule-entry.dto';
import { UpdateScheduleEntryDto } from '../dto/update-schedule-entry.dto';
import { ScheduleEntry } from '../entities/schedule-entry.entity';
import { ScheduleTimeSlot } from '../entities/schedule-time-slot.entity';
import {
  acquireScheduleConflictLocks,
  releaseScheduleConflictLocks,
  ScheduleEntryDuplicateException,
  ScheduleGroupConflictException,
  ScheduleOccurrenceInUseException,
  ScheduleTeacherConflictException,
} from '../utils/schedule-locks.util';
import {
  SCHEDULE_ENTRY_RELATIONS,
  ScheduleEntryView,
  ScheduleTimeSlotView,
  toScheduleEntryView,
} from '../utils/schedule-mappers.util';
import { resolveMyScheduleActorKind } from '../utils/my-schedule-actor.util';
import {
  groupScheduleOccurrences,
  resolveOccurrenceForEntry,
  scheduleEntryToOccurrenceInput,
  usedEntryIdsFromRuns,
} from '../utils/schedule-occurrence-protection.util';
import { ScheduleSlotType } from '../../../common/enums/schedule-slot-type.enum';
import { ScheduleTimeSlotsService } from './schedule-time-slots.service';

export type ScheduleEntryListFilters = {
  teacherId?: number;
  groupId?: number;
  periodId?: number;
  dayOfWeek?: number;
};

export type ScheduleOwnEntryFilters = {
  periodId?: number;
  dayOfWeek?: number;
};

export type MyScheduleView = {
  timeSlots: ScheduleTimeSlotView[];
  entries: ScheduleEntryView[];
};

export type MyScheduleActor = {
  id: number;
  roles: readonly string[];
};

@Injectable()
export class ScheduleEntriesService {
  constructor(
    @InjectRepository(ScheduleEntry)
    private readonly entries: Repository<ScheduleEntry>,
    @InjectRepository(TeachingAssignment)
    private readonly teachingAssignments: Repository<TeachingAssignment>,
    @InjectRepository(AttendanceSession)
    private readonly attendanceSessions: Repository<AttendanceSession>,
    private readonly timeSlots: ScheduleTimeSlotsService,
    private readonly eligibility: AcademicOfferingEligibilityService,
    private readonly groupEnrollments: GroupEnrollmentsService,
    private readonly dataSource: DataSource,
  ) {}

  async list(filters: ScheduleEntryListFilters = {}): Promise<ScheduleEntryView[]> {
    const qb = this.createEntriesListQuery();

    if (filters.teacherId != null) {
      qb.andWhere('ta.userId = :teacherId', { teacherId: filters.teacherId });
    }
    if (filters.groupId != null) {
      qb.andWhere('ta.groupId = :groupId', { groupId: filters.groupId });
    }
    if (filters.periodId != null) {
      qb.andWhere('ta.academicPeriodId = :periodId', {
        periodId: filters.periodId,
      });
    }
    if (filters.dayOfWeek != null) {
      qb.andWhere('entry.dayOfWeek = :dayOfWeek', {
        dayOfWeek: filters.dayOfWeek,
      });
    }

    const rows = await qb.getMany();
    return rows.map(toScheduleEntryView);
  }

  /**
   * Teacher "my schedule" entries — actorUserId is mandatory in the SQL WHERE.
   * Never accepts a client-supplied teacherId.
   */
  async listOwn(
    actorUserId: number,
    filters: ScheduleOwnEntryFilters = {},
  ): Promise<ScheduleEntryView[]> {
    if (!Number.isInteger(actorUserId) || actorUserId <= 0) {
      throw new BadRequestException({
        code: 'SCHEDULE_ACTOR_INVALID',
        message: 'Authenticated actor id is required for own schedule',
      });
    }

    const qb = this.createEntriesListQuery();
    qb.andWhere('ta.userId = :actorUserId', { actorUserId });

    if (filters.periodId != null) {
      qb.andWhere('ta.academicPeriodId = :periodId', {
        periodId: filters.periodId,
      });
    }
    if (filters.dayOfWeek != null) {
      qb.andWhere('entry.dayOfWeek = :dayOfWeek', {
        dayOfWeek: filters.dayOfWeek,
      });
    }

    const rows = await qb.getMany();
    return rows.map(toScheduleEntryView);
  }

  /**
   * Student "my schedule" — group resolved from GroupEnrollment only.
   * Never accepts client groupId/teacherId/userId.
   *
   * Period policy (E1): one weekly matrix → if multiple non-overlapping
   * enrollments exist for the same period (e.g. transfer), use latest
   * starts_on DESC (same deterministic strategy as findGroupAsOf ordering).
   */
  async listOwnForStudent(
    actorUserId: number,
    filters: ScheduleOwnEntryFilters = {},
  ): Promise<ScheduleEntryView[]> {
    if (!Number.isInteger(actorUserId) || actorUserId <= 0) {
      throw new BadRequestException({
        code: 'SCHEDULE_ACTOR_INVALID',
        message: 'Authenticated actor id is required for own schedule',
      });
    }

    const groupId = await this.resolveStudentGroupId(
      actorUserId,
      filters.periodId,
    );
    if (groupId == null) {
      return [];
    }

    const qb = this.createEntriesListQuery();
    qb.andWhere('ta.groupId = :studentGroupId', { studentGroupId: groupId });

    if (filters.periodId != null) {
      qb.andWhere('ta.academicPeriodId = :periodId', {
        periodId: filters.periodId,
      });
    }
    if (filters.dayOfWeek != null) {
      qb.andWhere('entry.dayOfWeek = :dayOfWeek', {
        dayOfWeek: filters.dayOfWeek,
      });
    }

    const rows = await qb.getMany();
    return rows.map(toScheduleEntryView);
  }

  async getMySchedule(
    actor: MyScheduleActor,
    filters: ScheduleOwnEntryFilters = {},
  ): Promise<MyScheduleView> {
    const kind = resolveMyScheduleActorKind(actor.roles ?? []);
    const entriesPromise =
      kind === 'student'
        ? this.listOwnForStudent(actor.id, filters)
        : kind === 'teacher'
          ? this.listOwn(actor.id, filters)
          : Promise.resolve([]);

    const [timeSlots, entries] = await Promise.all([
      this.timeSlots.list(),
      entriesPromise,
    ]);
    return { timeSlots, entries };
  }

  private async resolveStudentGroupId(
    actorUserId: number,
    periodId?: number,
  ): Promise<number | null> {
    if (periodId != null) {
      const enrollment = await this.groupEnrollments.findLatestForPeriod(
        actorUserId,
        periodId,
      );
      return enrollment?.groupId ?? null;
    }

    const today = calendarDateInTimeZone(new Date());
    const enrollment = await this.groupEnrollments.findGroupAsOf(
      actorUserId,
      today,
    );
    return enrollment?.groupId ?? null;
  }

  private createEntriesListQuery() {
    return this.entries
      .createQueryBuilder('entry')
      .leftJoinAndSelect('entry.timeSlot', 'timeSlot')
      .leftJoinAndSelect('entry.teachingAssignment', 'ta')
      .leftJoinAndSelect('ta.user', 'user')
      .leftJoinAndSelect('ta.group', 'grp')
      .leftJoinAndSelect('grp.section', 'section')
      .leftJoinAndSelect('ta.subject', 'subject')
      .leftJoinAndSelect('ta.specialty', 'specialty')
      .leftJoinAndSelect('ta.academicPeriod', 'period')
      .orderBy('entry.dayOfWeek', 'ASC')
      .addOrderBy('timeSlot.displayOrder', 'ASC')
      .addOrderBy('entry.id', 'ASC');
  }

  async findOne(id: number): Promise<ScheduleEntryView> {
    const entry = await this.requireEntry(id);
    return toScheduleEntryView(entry);
  }

  async create(dto: CreateScheduleEntryDto): Promise<ScheduleEntryView> {
    this.assertDayOfWeek(dto.dayOfWeek);
    return this.runWithScheduleLocks(
      async (queryRunner) => {
        const manager = queryRunner.manager;
        const ta = await this.loadAndValidateTeachingAssignment(
          manager,
          dto.teachingAssignmentId,
        );
        await this.timeSlots.requireAssignableSlot(dto.timeSlotId, manager);
        await this.lockTimeSlot(manager, dto.timeSlotId);

        return {
          lockInput: {
            teacherId: ta.userId,
            groupId: ta.groupId,
            dayOfWeek: dto.dayOfWeek,
            timeSlotId: dto.timeSlotId,
          },
          work: async () => {
            await this.assertNoConflicts(manager, {
              teacherId: ta.userId,
              groupId: ta.groupId,
              teachingAssignmentId: ta.id,
              dayOfWeek: dto.dayOfWeek,
              timeSlotId: dto.timeSlotId,
            });

            const slot = await manager.getRepository(ScheduleTimeSlot).findOne({
              where: { id: dto.timeSlotId },
            });
            if (!slot) {
              throw new NotFoundException(
                `ScheduleTimeSlot ${dto.timeSlotId} not found`,
              );
            }
            await this.assertCreateDoesNotJoinUsedOccurrence(manager, {
              teachingAssignmentId: ta.id,
              dayOfWeek: dto.dayOfWeek,
              slot,
            });

            try {
              const repo = manager.getRepository(ScheduleEntry);
              const saved = await repo.save(
                repo.create({
                  teachingAssignmentId: ta.id,
                  dayOfWeek: dto.dayOfWeek,
                  timeSlotId: dto.timeSlotId,
                }),
              );
              return toScheduleEntryView(await this.loadEntry(manager, saved.id));
            } catch (error) {
              this.rethrowDuplicate(error);
              throw error;
            }
          },
        };
      },
    );
  }

  async update(
    id: number,
    dto: UpdateScheduleEntryDto,
  ): Promise<ScheduleEntryView> {
    return this.runWithScheduleLocks(
      async (queryRunner) => {
        const manager = queryRunner.manager;
        const existing = await manager.getRepository(ScheduleEntry).findOne({
          where: { id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!existing) {
          throw new NotFoundException(`ScheduleEntry ${id} not found`);
        }

        const teachingAssignmentId =
          dto.teachingAssignmentId ?? existing.teachingAssignmentId;
        const dayOfWeek = dto.dayOfWeek ?? existing.dayOfWeek;
        const timeSlotId = dto.timeSlotId ?? existing.timeSlotId;
        this.assertDayOfWeek(dayOfWeek);

        const ta = await this.loadAndValidateTeachingAssignment(
          manager,
          teachingAssignmentId,
        );
        await this.timeSlots.requireAssignableSlot(timeSlotId, manager);
        await this.lockTimeSlot(manager, timeSlotId);

        return {
          lockInput: {
            teacherId: ta.userId,
            groupId: ta.groupId,
            dayOfWeek,
            timeSlotId,
          },
          work: async () => {
            await this.assertNoConflicts(manager, {
              teacherId: ta.userId,
              groupId: ta.groupId,
              teachingAssignmentId: ta.id,
              dayOfWeek,
              timeSlotId,
              excludeEntryId: existing.id,
            });

            await this.assertUpdateDoesNotAffectUsedOccurrence(manager, {
              existing,
              teachingAssignmentId: ta.id,
              dayOfWeek,
              timeSlotId,
            });

            existing.teachingAssignmentId = ta.id;
            existing.dayOfWeek = dayOfWeek;
            existing.timeSlotId = timeSlotId;

            try {
              await manager.getRepository(ScheduleEntry).save(existing);
              return toScheduleEntryView(
                await this.loadEntry(manager, existing.id),
              );
            } catch (error) {
              this.rethrowDuplicate(error);
              throw error;
            }
          },
        };
      },
    );
  }

  async remove(id: number): Promise<{ deleted: true }> {
    const entry = await this.entries.findOne({
      where: { id },
      relations: { timeSlot: true },
    });
    if (!entry) throw new NotFoundException(`ScheduleEntry ${id} not found`);
    await this.assertDeleteDoesNotAffectUsedOccurrence(entry);
    await this.entries.remove(entry);
    return { deleted: true };
  }

  /**
   * Explicit QueryRunner lifecycle:
   * connect → START TX → (caller prep) → GET_LOCK → work → COMMIT → RELEASE → release()
   * On error: ROLLBACK → RELEASE → release(), preserving original error.
   */
  private async runWithScheduleLocks<T>(
    prepare: (queryRunner: QueryRunner) => Promise<{
      lockInput: {
        teacherId: number;
        groupId: number;
        dayOfWeek: number;
        timeSlotId: number;
      };
      work: () => Promise<T>;
    }>,
  ): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let acquiredKeys: string[] = [];
    let committed = false;
    let primaryError: unknown;

    try {
      const { lockInput, work } = await prepare(queryRunner);
      acquiredKeys = await acquireScheduleConflictLocks(queryRunner, lockInput);
      const result = await work();
      await queryRunner.commitTransaction();
      committed = true;

      // Named locks held until AFTER commit on the same connection.
      try {
        await releaseScheduleConflictLocks(queryRunner, acquiredKeys);
      } catch {
        // Best-effort after successful commit — do not mask success.
      }
      acquiredKeys = [];
      return result;
    } catch (error) {
      primaryError = error;
      if (queryRunner.isTransactionActive) {
        try {
          await queryRunner.rollbackTransaction();
        } catch {
          // keep primaryError
        }
      }
      if (acquiredKeys.length > 0) {
        try {
          await releaseScheduleConflictLocks(queryRunner, acquiredKeys);
        } catch {
          // cleanup must not hide business error
        }
        acquiredKeys = [];
      }
      throw primaryError;
    } finally {
      if (!committed && acquiredKeys.length > 0) {
        try {
          await releaseScheduleConflictLocks(queryRunner, acquiredKeys);
        } catch {
          // ignore — primary already set or success path handled
        }
      }
      await queryRunner.release();
    }
  }

  private assertDayOfWeek(dayOfWeek: number): void {
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 5) {
      throw new BadRequestException({
        code: 'SCHEDULE_DAY_OF_WEEK_INVALID',
        message: 'dayOfWeek must be an integer between 1 (Monday) and 5 (Friday)',
      });
    }
  }

  private async loadAndValidateTeachingAssignment(
    manager: EntityManager,
    id: number,
  ): Promise<TeachingAssignment> {
    const ta = await manager.getRepository(TeachingAssignment).findOne({
      where: { id },
      relations: {
        group: { section: true },
        subject: true,
        specialty: true,
      },
      lock: { mode: 'pessimistic_write' },
    });
    if (!ta) {
      throw new NotFoundException(`TeachingAssignment ${id} not found`);
    }
    if (isGuideOnlyAssignment(ta) || !isImpartableTeachingAssignment(ta)) {
      throw new BadRequestException({
        code: 'SCHEDULE_TA_NOT_IMPARTABLE',
        message:
          'Guide-only or non-impartable teaching assignments cannot be scheduled',
      });
    }
    if (!ta.offeringKind) {
      throw new BadRequestException({
        code: 'SCHEDULE_TA_NOT_IMPARTABLE',
        message: 'Teaching assignment has no offeringKind',
      });
    }

    await this.eligibility.resolveOffering({
      offeringKind: ta.offeringKind,
      subjectId: ta.subjectId,
      specialtyId: ta.specialtyId,
    });
    await this.eligibility.assertOfferingAllowedForGroup(
      ta.groupId,
      ta.offeringKind,
    );

    return ta;
  }

  private async lockTimeSlot(
    manager: EntityManager,
    timeSlotId: number,
  ): Promise<ScheduleTimeSlot> {
    const slot = await manager.getRepository(ScheduleTimeSlot).findOne({
      where: { id: timeSlotId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!slot) {
      throw new NotFoundException(`ScheduleTimeSlot ${timeSlotId} not found`);
    }
    return slot;
  }

  private async assertNoConflicts(
    manager: EntityManager,
    input: {
      teacherId: number;
      groupId: number;
      teachingAssignmentId: number;
      dayOfWeek: number;
      timeSlotId: number;
      excludeEntryId?: number;
    },
  ): Promise<void> {
    const qb = manager
      .getRepository(ScheduleEntry)
      .createQueryBuilder('entry')
      .innerJoinAndSelect('entry.teachingAssignment', 'ta')
      .where('entry.dayOfWeek = :dayOfWeek', { dayOfWeek: input.dayOfWeek })
      .andWhere('entry.timeSlotId = :timeSlotId', {
        timeSlotId: input.timeSlotId,
      })
      .andWhere('(ta.userId = :teacherId OR ta.groupId = :groupId)', {
        teacherId: input.teacherId,
        groupId: input.groupId,
      });

    if (input.excludeEntryId != null) {
      qb.andWhere('entry.id != :excludeEntryId', {
        excludeEntryId: input.excludeEntryId,
      });
    }

    const conflicts = await qb.getMany();
    for (const row of conflicts) {
      if (row.teachingAssignmentId === input.teachingAssignmentId) {
        throw new ScheduleEntryDuplicateException({
          teachingAssignmentId: input.teachingAssignmentId,
          dayOfWeek: input.dayOfWeek,
          timeSlotId: input.timeSlotId,
        });
      }
      if (row.teachingAssignment.userId === input.teacherId) {
        throw new ScheduleTeacherConflictException({
          teacherId: input.teacherId,
          dayOfWeek: input.dayOfWeek,
          timeSlotId: input.timeSlotId,
          conflictingEntryId: row.id,
        });
      }
      if (row.teachingAssignment.groupId === input.groupId) {
        throw new ScheduleGroupConflictException({
          groupId: input.groupId,
          dayOfWeek: input.dayOfWeek,
          timeSlotId: input.timeSlotId,
          conflictingEntryId: row.id,
        });
      }
    }

    const exact = await manager.getRepository(ScheduleEntry).findOne({
      where: {
        teachingAssignmentId: input.teachingAssignmentId,
        dayOfWeek: input.dayOfWeek,
        timeSlotId: input.timeSlotId,
      },
    });
    if (exact && exact.id !== input.excludeEntryId) {
      throw new ScheduleEntryDuplicateException({
        teachingAssignmentId: input.teachingAssignmentId,
        dayOfWeek: input.dayOfWeek,
        timeSlotId: input.timeSlotId,
      });
    }
  }

  private async requireEntry(id: number): Promise<ScheduleEntry> {
    const entry = await this.entries.findOne({
      where: { id },
      relations: SCHEDULE_ENTRY_RELATIONS as never,
    });
    if (!entry) throw new NotFoundException(`ScheduleEntry ${id} not found`);
    return entry;
  }

  private async loadEntry(
    manager: EntityManager,
    id: number,
  ): Promise<ScheduleEntry> {
    const entry = await manager.getRepository(ScheduleEntry).findOne({
      where: { id },
      relations: SCHEDULE_ENTRY_RELATIONS as never,
    });
    if (!entry) throw new NotFoundException(`ScheduleEntry ${id} not found`);
    return entry;
  }

  private async loadOccurrenceInputsForTaDay(
    manager: EntityManager | null,
    teachingAssignmentId: number,
    dayOfWeek: number,
  ) {
    const repo = manager
      ? manager.getRepository(ScheduleEntry)
      : this.entries;
    const rows = await repo.find({
      where: { teachingAssignmentId, dayOfWeek },
      relations: { timeSlot: true },
    });
    return rows.map(scheduleEntryToOccurrenceInput);
  }

  private async usedAnchorsAmong(
    anchorIds: number[],
    manager?: EntityManager,
  ): Promise<Set<number>> {
    if (anchorIds.length === 0) return new Set();
    const repo = manager
      ? manager.getRepository(AttendanceSession)
      : this.attendanceSessions;
    const sessions = await repo.find({
      where: { scheduleEntryId: In(anchorIds) },
      select: { id: true, scheduleEntryId: true },
    });
    return new Set(
      sessions
        .map((s) => s.scheduleEntryId)
        .filter((id): id is number => id != null),
    );
  }

  private async assertCreateDoesNotJoinUsedOccurrence(
    manager: EntityManager,
    input: {
      teachingAssignmentId: number;
      dayOfWeek: number;
      slot: ScheduleTimeSlot;
    },
  ): Promise<void> {
    if (input.slot.slotType !== ScheduleSlotType.CLASS) {
      return;
    }
    const existingInputs = await this.loadOccurrenceInputsForTaDay(
      manager,
      input.teachingAssignmentId,
      input.dayOfWeek,
    );
    const runsBefore = groupScheduleOccurrences(existingInputs);
    const usedAnchors = await this.usedAnchorsAmong(
      runsBefore.map((r) => r.anchorEntryId),
      manager,
    );
    if (usedAnchors.size === 0) return;

    const usedEntryIds = usedEntryIdsFromRuns(runsBefore, usedAnchors);
    const provisionalId = -1;
    const withNew = [
      ...existingInputs,
      {
        id: provisionalId,
        teachingAssignmentId: input.teachingAssignmentId,
        dayOfWeek: input.dayOfWeek,
        slotType: ScheduleSlotType.CLASS,
        startTime: String(input.slot.startTime),
        endTime: String(input.slot.endTime),
        displayOrder: input.slot.displayOrder,
      },
    ];
    const joined = resolveOccurrenceForEntry(withNew, provisionalId);
    if (!joined) return;
    const touchesUsed = joined.entryIds.some(
      (id) => id !== provisionalId && usedEntryIds.has(id),
    );
    if (touchesUsed) {
      throw new ScheduleOccurrenceInUseException({
        operation: 'create',
        teachingAssignmentId: input.teachingAssignmentId,
        dayOfWeek: input.dayOfWeek,
        anchorEntryId: joined.anchorEntryId,
      });
    }
  }

  private async assertUpdateDoesNotAffectUsedOccurrence(
    manager: EntityManager,
    input: {
      existing: ScheduleEntry;
      teachingAssignmentId: number;
      dayOfWeek: number;
      timeSlotId: number;
    },
  ): Promise<void> {
    const unchanged =
      input.existing.teachingAssignmentId === input.teachingAssignmentId &&
      input.existing.dayOfWeek === input.dayOfWeek &&
      input.existing.timeSlotId === input.timeSlotId;
    if (unchanged) return;

    const existingLoaded = await manager.getRepository(ScheduleEntry).findOne({
      where: { id: input.existing.id },
      relations: { timeSlot: true },
    });
    if (!existingLoaded?.timeSlot) {
      throw new NotFoundException(
        `ScheduleEntry ${input.existing.id} not found`,
      );
    }

    const beforeInputs = await this.loadOccurrenceInputsForTaDay(
      manager,
      existingLoaded.teachingAssignmentId,
      existingLoaded.dayOfWeek,
    );
    const beforeRuns = groupScheduleOccurrences(beforeInputs);
    const beforeUsedAnchors = await this.usedAnchorsAmong(
      beforeRuns.map((r) => r.anchorEntryId),
      manager,
    );
    const beforeUsed = usedEntryIdsFromRuns(beforeRuns, beforeUsedAnchors);
    if (beforeUsed.has(existingLoaded.id)) {
      throw new ScheduleOccurrenceInUseException({
        operation: 'update',
        entryId: existingLoaded.id,
      });
    }

    const newSlot = await manager.getRepository(ScheduleTimeSlot).findOne({
      where: { id: input.timeSlotId },
    });
    if (!newSlot) {
      throw new NotFoundException(
        `ScheduleTimeSlot ${input.timeSlotId} not found`,
      );
    }
    if (newSlot.slotType !== ScheduleSlotType.CLASS) {
      return;
    }

    const targetInputs = (
      await this.loadOccurrenceInputsForTaDay(
        manager,
        input.teachingAssignmentId,
        input.dayOfWeek,
      )
    ).filter((e) => e.id !== existingLoaded.id);

    const provisional = {
      id: existingLoaded.id,
      teachingAssignmentId: input.teachingAssignmentId,
      dayOfWeek: input.dayOfWeek,
      slotType: ScheduleSlotType.CLASS,
      startTime: String(newSlot.startTime),
      endTime: String(newSlot.endTime),
      displayOrder: newSlot.displayOrder,
    };
    const afterRunsWithoutMove = groupScheduleOccurrences(targetInputs);
    const afterUsedAnchors = await this.usedAnchorsAmong(
      afterRunsWithoutMove.map((r) => r.anchorEntryId),
      manager,
    );
    const afterUsed = usedEntryIdsFromRuns(
      afterRunsWithoutMove,
      afterUsedAnchors,
    );
    const joined = resolveOccurrenceForEntry(
      [...targetInputs, provisional],
      existingLoaded.id,
    );
    if (
      joined &&
      joined.entryIds.some((id) => id !== existingLoaded.id && afterUsed.has(id))
    ) {
      throw new ScheduleOccurrenceInUseException({
        operation: 'update_join',
        entryId: existingLoaded.id,
        anchorEntryId: joined.anchorEntryId,
      });
    }
  }

  private async assertDeleteDoesNotAffectUsedOccurrence(
    entry: ScheduleEntry,
  ): Promise<void> {
    const inputs = await this.loadOccurrenceInputsForTaDay(
      null,
      entry.teachingAssignmentId,
      entry.dayOfWeek,
    );
    const runs = groupScheduleOccurrences(inputs);
    const usedAnchors = await this.usedAnchorsAmong(
      runs.map((r) => r.anchorEntryId),
    );
    const used = usedEntryIdsFromRuns(runs, usedAnchors);
    if (used.has(entry.id)) {
      throw new ScheduleOccurrenceInUseException({
        operation: 'delete',
        entryId: entry.id,
      });
    }
  }

  private rethrowDuplicate(error: unknown): void {
    const err = error as { code?: string; errno?: number };
    if (err?.code === 'ER_DUP_ENTRY' || err?.errno === 1062) {
      throw new ScheduleEntryDuplicateException();
    }
  }
}
