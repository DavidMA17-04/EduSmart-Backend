import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryRunner, Repository } from 'typeorm';
import { ScheduleSlotType } from '../../../common/enums/schedule-slot-type.enum';
import { CreateScheduleTimeSlotDto } from '../dto/create-schedule-time-slot.dto';
import { UpdateScheduleTimeSlotDto } from '../dto/update-schedule-time-slot.dto';
import { ScheduleEntry } from '../entities/schedule-entry.entity';
import { ScheduleTimeSlot } from '../entities/schedule-time-slot.entity';
import {
  ScheduleTimeSlotView,
  toTimeSlotView,
} from '../utils/schedule-mappers.util';
import {
  acquireScheduleTimeSlotsMutateLock,
  assertLessonNumberForSlotType,
  assertScheduleTimeSlotRange,
  normalizeScheduleTimeInput,
  releaseScheduleTimeSlotsMutateLock,
  ScheduleTimeSlotDisplayOrderConflictException,
  ScheduleTimeSlotInUseException,
  ScheduleTimeSlotLessonNumberConflictException,
  ScheduleTimeSlotOverlapException,
} from '../utils/schedule-time-slot-mutations.util';

type ResultantSlotState = {
  lessonNumber: number | null;
  name: string;
  startTime: string;
  endTime: string;
  displayOrder: number;
  slotType: ScheduleSlotType;
  isActive: boolean;
};

@Injectable()
export class ScheduleTimeSlotsService {
  constructor(
    @InjectRepository(ScheduleTimeSlot)
    private readonly slots: Repository<ScheduleTimeSlot>,
    @InjectRepository(ScheduleEntry)
    private readonly entries: Repository<ScheduleEntry>,
    private readonly dataSource: DataSource,
  ) {}

  async list(): Promise<ScheduleTimeSlotView[]> {
    const rows = await this.slots.find({
      order: { displayOrder: 'ASC', id: 'ASC' },
    });
    return rows.map(toTimeSlotView);
  }

  async findOne(id: number): Promise<ScheduleTimeSlotView> {
    const slot = await this.requireSlot(id);
    return toTimeSlotView(slot);
  }

  async create(dto: CreateScheduleTimeSlotDto): Promise<ScheduleTimeSlotView> {
    return this.runWithTimeSlotMutateLock(async (queryRunner) => {
      const manager = queryRunner.manager;
      const startTime = normalizeScheduleTimeInput(dto.startTime);
      const endTime = normalizeScheduleTimeInput(dto.endTime);
      assertScheduleTimeSlotRange(startTime, endTime);

      const lessonNumber = assertLessonNumberForSlotType(
        dto.slotType,
        dto.lessonNumber,
      );
      const isActive = dto.isActive ?? true;
      const name = dto.name.trim();
      const displayOrder = dto.displayOrder;
      const slotType = dto.slotType;

      if (isActive) {
        await this.assertNoActiveOverlap(manager, {
          startTime,
          endTime,
        });
        await this.assertActiveDisplayOrderFree(manager, displayOrder);
        await this.assertActiveLessonNumberFree(manager, {
          slotType,
          lessonNumber,
        });
      }

      const repo = manager.getRepository(ScheduleTimeSlot);
      const saved = await repo.save(
        repo.create({
          lessonNumber,
          name,
          startTime,
          endTime,
          displayOrder,
          slotType,
          isActive,
        }),
      );
      return toTimeSlotView(saved);
    });
  }

  async update(
    id: number,
    dto: UpdateScheduleTimeSlotDto,
  ): Promise<ScheduleTimeSlotView> {
    return this.runWithTimeSlotMutateLock(async (queryRunner) => {
      const manager = queryRunner.manager;
      const slot = await manager.getRepository(ScheduleTimeSlot).findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!slot) {
        throw new NotFoundException(`ScheduleTimeSlot ${id} not found`);
      }

      const hasEntries = await manager.getRepository(ScheduleEntry).exists({
        where: { timeSlotId: id },
      });

      const resultant = this.buildResultantState(slot, dto);
      assertScheduleTimeSlotRange(resultant.startTime, resultant.endTime);
      resultant.lessonNumber = assertLessonNumberForSlotType(
        resultant.slotType,
        resultant.lessonNumber,
      );

      if (hasEntries) {
        const startChanged =
          normalizeScheduleTimeInput(slot.startTime) !== resultant.startTime;
        const endChanged =
          normalizeScheduleTimeInput(slot.endTime) !== resultant.endTime;
        const typeChanged = slot.slotType !== resultant.slotType;

        if (startChanged || endChanged || typeChanged) {
          throw new ScheduleTimeSlotInUseException({
            operation: 'update_immutable_fields',
            message:
              'Cannot change startTime, endTime, or slotType while schedule entries reference this time slot',
            timeSlotId: id,
            startChanged,
            endChanged,
            typeChanged,
          });
        }
      }

      if (resultant.isActive) {
        await this.assertNoActiveOverlap(manager, {
          startTime: resultant.startTime,
          endTime: resultant.endTime,
          excludeId: id,
        });
        await this.assertActiveDisplayOrderFree(
          manager,
          resultant.displayOrder,
          id,
        );
        await this.assertActiveLessonNumberFree(
          manager,
          {
            slotType: resultant.slotType,
            lessonNumber: resultant.lessonNumber,
          },
          id,
        );
      }

      slot.lessonNumber = resultant.lessonNumber;
      slot.name = resultant.name;
      slot.startTime = resultant.startTime;
      slot.endTime = resultant.endTime;
      slot.displayOrder = resultant.displayOrder;
      slot.slotType = resultant.slotType;
      slot.isActive = resultant.isActive;

      const saved = await manager.getRepository(ScheduleTimeSlot).save(slot);
      return toTimeSlotView(saved);
    });
  }

  /**
   * Physical delete only when unused. Prefer is_active=false otherwise.
   */
  async remove(id: number): Promise<{ deleted: true } | ScheduleTimeSlotView> {
    return this.runWithTimeSlotMutateLock(async (queryRunner) => {
      const manager = queryRunner.manager;
      const slot = await manager.getRepository(ScheduleTimeSlot).findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!slot) {
        throw new NotFoundException(`ScheduleTimeSlot ${id} not found`);
      }

      const inUse = await manager.getRepository(ScheduleEntry).exists({
        where: { timeSlotId: id },
      });
      if (inUse) {
        throw new ScheduleTimeSlotInUseException({
          operation: 'delete',
          timeSlotId: id,
        });
      }

      await manager.getRepository(ScheduleTimeSlot).remove(slot);
      return { deleted: true };
    });
  }

  /**
   * CLASS + active only. Prefer passing EntityManager when called inside a
   * QueryRunner transaction so the lookup uses the same connection.
   */
  async requireAssignableSlot(
    id: number,
    manager?: EntityManager,
  ): Promise<ScheduleTimeSlot> {
    const slot = await this.requireSlot(id, manager);
    if (!slot.isActive) {
      throw new BadRequestException({
        code: 'SCHEDULE_TIME_SLOT_INACTIVE',
        message: 'Time slot is inactive and cannot receive assignments',
      });
    }
    if (slot.slotType !== ScheduleSlotType.CLASS) {
      throw new BadRequestException({
        code: 'SCHEDULE_TIME_SLOT_NOT_ASSIGNABLE',
        message: 'Only CLASS time slots can receive teaching assignments',
        slotType: slot.slotType,
      });
    }
    return slot;
  }

  async requireSlot(
    id: number,
    manager?: EntityManager,
  ): Promise<ScheduleTimeSlot> {
    const repo = manager
      ? manager.getRepository(ScheduleTimeSlot)
      : this.slots;
    const slot = await repo.findOne({ where: { id } });
    if (!slot) throw new NotFoundException(`ScheduleTimeSlot ${id} not found`);
    return slot;
  }

  /** @deprecated Prefer assertScheduleTimeSlotRange — kept for callers/tests. */
  assertStartBeforeEnd(startTime: string, endTime: string): void {
    assertScheduleTimeSlotRange(startTime, endTime);
  }

  /**
   * Lifecycle:
   * connect → GET_LOCK → START TX → work → COMMIT → RELEASE_LOCK → release()
   * Error: ROLLBACK → RELEASE_LOCK best-effort → release(); preserve primary error.
   */
  private async runWithTimeSlotMutateLock<T>(
    work: (queryRunner: QueryRunner) => Promise<T>,
  ): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    let lockHeld = false;
    let committed = false;
    let primaryError: unknown;

    try {
      await acquireScheduleTimeSlotsMutateLock(queryRunner);
      lockHeld = true;
      await queryRunner.startTransaction();

      const result = await work(queryRunner);
      await queryRunner.commitTransaction();
      committed = true;

      try {
        await releaseScheduleTimeSlotsMutateLock(queryRunner);
      } catch {
        // Best-effort after successful commit — do not mask success.
      }
      lockHeld = false;
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
      if (lockHeld) {
        try {
          await releaseScheduleTimeSlotsMutateLock(queryRunner);
        } catch {
          // cleanup must not hide business error
        }
        lockHeld = false;
      }
      throw primaryError;
    } finally {
      if (lockHeld) {
        try {
          await releaseScheduleTimeSlotsMutateLock(queryRunner);
        } catch {
          // ignore
        }
      }
      await queryRunner.release();
    }
  }

  private buildResultantState(
    slot: ScheduleTimeSlot,
    dto: UpdateScheduleTimeSlotDto,
  ): ResultantSlotState {
    const startTime = normalizeScheduleTimeInput(
      dto.startTime !== undefined ? dto.startTime : String(slot.startTime),
    );
    const endTime = normalizeScheduleTimeInput(
      dto.endTime !== undefined ? dto.endTime : String(slot.endTime),
    );
    const slotType = dto.slotType !== undefined ? dto.slotType : slot.slotType;
    const lessonNumber =
      dto.lessonNumber !== undefined ? dto.lessonNumber : slot.lessonNumber;

    return {
      lessonNumber: lessonNumber ?? null,
      name: dto.name !== undefined ? dto.name.trim() : slot.name,
      startTime,
      endTime,
      displayOrder:
        dto.displayOrder !== undefined ? dto.displayOrder : slot.displayOrder,
      slotType,
      isActive: dto.isActive !== undefined ? dto.isActive : slot.isActive,
    };
  }

  private async assertNoActiveOverlap(
    manager: EntityManager,
    input: { startTime: string; endTime: string; excludeId?: number },
  ): Promise<void> {
    const qb = manager
      .getRepository(ScheduleTimeSlot)
      .createQueryBuilder('slot')
      .where('slot.isActive = :active', { active: true })
      .andWhere('slot.startTime < :candidateEnd', {
        candidateEnd: input.endTime,
      })
      .andWhere('slot.endTime > :candidateStart', {
        candidateStart: input.startTime,
      });

    if (input.excludeId != null) {
      qb.andWhere('slot.id != :excludeId', { excludeId: input.excludeId });
    }

    const conflicting = await qb.getOne();
    if (conflicting) {
      throw new ScheduleTimeSlotOverlapException({
        conflictingSlotId: conflicting.id,
        candidateStart: input.startTime,
        candidateEnd: input.endTime,
      });
    }
  }

  private async assertActiveDisplayOrderFree(
    manager: EntityManager,
    displayOrder: number,
    excludeId?: number,
  ): Promise<void> {
    const qb = manager
      .getRepository(ScheduleTimeSlot)
      .createQueryBuilder('slot')
      .where('slot.isActive = :active', { active: true })
      .andWhere('slot.displayOrder = :displayOrder', { displayOrder });

    if (excludeId != null) {
      qb.andWhere('slot.id != :excludeId', { excludeId });
    }

    const conflicting = await qb.getOne();
    if (conflicting) {
      throw new ScheduleTimeSlotDisplayOrderConflictException({
        displayOrder,
        conflictingSlotId: conflicting.id,
      });
    }
  }

  private async assertActiveLessonNumberFree(
    manager: EntityManager,
    input: { slotType: ScheduleSlotType; lessonNumber: number | null },
    excludeId?: number,
  ): Promise<void> {
    if (
      input.slotType !== ScheduleSlotType.CLASS ||
      input.lessonNumber == null
    ) {
      return;
    }

    const qb = manager
      .getRepository(ScheduleTimeSlot)
      .createQueryBuilder('slot')
      .where('slot.isActive = :active', { active: true })
      .andWhere('slot.slotType = :slotType', {
        slotType: ScheduleSlotType.CLASS,
      })
      .andWhere('slot.lessonNumber = :lessonNumber', {
        lessonNumber: input.lessonNumber,
      });

    if (excludeId != null) {
      qb.andWhere('slot.id != :excludeId', { excludeId });
    }

    const conflicting = await qb.getOne();
    if (conflicting) {
      throw new ScheduleTimeSlotLessonNumberConflictException({
        lessonNumber: input.lessonNumber,
        conflictingSlotId: conflicting.id,
      });
    }
  }
}
