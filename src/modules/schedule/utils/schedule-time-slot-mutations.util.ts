import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { ScheduleSlotType } from '../../../common/enums/schedule-slot-type.enum';

/** Global named lock serializing all ScheduleTimeSlot create/update/delete. */
export const SCHEDULE_TIME_SLOTS_MUTATE_LOCK_KEY =
  'edusmart:sched:time-slots:mutate';

export function normalizeScheduleTimeInput(value: string): string {
  const trimmed = String(value ?? '').trim();
  if (/^\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`;
  const match = trimmed.match(/^(\d{2}:\d{2}:\d{2})/);
  if (match) return match[1];
  return trimmed;
}

export function scheduleTimeToSeconds(value: string): number {
  const normalized = normalizeScheduleTimeInput(value);
  const [h, m, s] = normalized.split(':').map(Number);
  return h * 3600 + m * 60 + (s || 0);
}

/**
 * True when open intervals (start, end) overlap.
 * Touching edges (A.end === B.start) do NOT overlap.
 */
export function scheduleTimesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  const as = scheduleTimeToSeconds(aStart);
  const ae = scheduleTimeToSeconds(aEnd);
  const bs = scheduleTimeToSeconds(bStart);
  const be = scheduleTimeToSeconds(bEnd);
  return as < be && ae > bs;
}

export function assertScheduleTimeSlotRange(
  startTime: string,
  endTime: string,
): void {
  if (scheduleTimeToSeconds(startTime) >= scheduleTimeToSeconds(endTime)) {
    throw new BadRequestException({
      code: 'SCHEDULE_TIME_SLOT_INVALID_RANGE',
      message: 'startTime must be before endTime',
    });
  }
}

/**
 * Structural lessonNumber rules (active or inactive).
 * BREAK/LUNCH must be null; CLASS may be null or ≥ 1.
 */
export function assertLessonNumberForSlotType(
  slotType: ScheduleSlotType,
  lessonNumber: number | null | undefined,
): number | null {
  if (
    slotType === ScheduleSlotType.BREAK ||
    slotType === ScheduleSlotType.LUNCH
  ) {
    if (lessonNumber != null) {
      throw new BadRequestException({
        code: 'SCHEDULE_TIME_SLOT_LESSON_NUMBER_INVALID',
        message: 'BREAK and LUNCH time slots cannot have a lessonNumber',
        slotType,
      });
    }
    return null;
  }
  if (lessonNumber == null) return null;
  if (!Number.isInteger(lessonNumber) || lessonNumber < 1) {
    throw new BadRequestException({
      code: 'SCHEDULE_TIME_SLOT_LESSON_NUMBER_INVALID',
      message: 'lessonNumber must be a positive integer when set',
    });
  }
  return lessonNumber;
}

function readLockResult(rows: unknown): number | null {
  const row = Array.isArray(rows) ? (rows[0] as Record<string, unknown>) : null;
  const raw = row?.acquired ?? row?.ACQUIRED ?? row?.['GET_LOCK(?, 10)'];
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'bigint') return Number(raw);
  if (typeof raw === 'string' && raw.trim() !== '' && !Number.isNaN(Number(raw))) {
    return Number(raw);
  }
  return null;
}

export async function acquireScheduleTimeSlotsMutateLock(
  queryRunner: QueryRunner,
  timeoutSeconds = 10,
): Promise<string> {
  const key = SCHEDULE_TIME_SLOTS_MUTATE_LOCK_KEY;
  const rows = await queryRunner.query('SELECT GET_LOCK(?, ?) AS acquired', [
    key,
    timeoutSeconds,
  ]);
  const result = readLockResult(rows);

  if (result === 1) return key;

  if (result === 0) {
    throw new ServiceUnavailableException({
      code: 'SCHEDULE_TIME_SLOT_LOCK_TIMEOUT',
      message:
        'Could not acquire schedule time-slots mutate lock; retry later',
      lockKey: key,
    });
  }

  throw new ServiceUnavailableException({
    code: 'SCHEDULE_TIME_SLOT_LOCK_ERROR',
    message:
      'Named lock acquisition failed (NULL/error from GET_LOCK) for time-slots mutate',
    lockKey: key,
  });
}

/** Best-effort RELEASE_LOCK on the same QueryRunner connection. */
export async function releaseScheduleTimeSlotsMutateLock(
  queryRunner: QueryRunner,
): Promise<void> {
  await queryRunner.query('SELECT RELEASE_LOCK(?) AS released', [
    SCHEDULE_TIME_SLOTS_MUTATE_LOCK_KEY,
  ]);
}

export class ScheduleTimeSlotOverlapException extends ConflictException {
  constructor(details?: Record<string, unknown>) {
    super({
      code: 'SCHEDULE_TIME_SLOT_OVERLAP',
      message:
        'Active time slot overlaps another active time slot (edges may touch)',
      ...details,
    });
  }
}

export class ScheduleTimeSlotDisplayOrderConflictException extends ConflictException {
  constructor(details?: Record<string, unknown>) {
    super({
      code: 'SCHEDULE_TIME_SLOT_DISPLAY_ORDER_CONFLICT',
      message: 'Another active time slot already uses this displayOrder',
      ...details,
    });
  }
}

export class ScheduleTimeSlotLessonNumberConflictException extends ConflictException {
  constructor(details?: Record<string, unknown>) {
    super({
      code: 'SCHEDULE_TIME_SLOT_LESSON_NUMBER_CONFLICT',
      message: 'Another active CLASS time slot already uses this lessonNumber',
      ...details,
    });
  }
}

export class ScheduleTimeSlotInUseException extends ConflictException {
  constructor(details?: Record<string, unknown>) {
    super({
      code: 'SCHEDULE_TIME_SLOT_IN_USE',
      message:
        'Time slot is referenced by schedule entries; deactivate it instead',
      ...details,
    });
  }
}
