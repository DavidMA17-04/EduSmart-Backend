import {
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { QueryRunner } from 'typeorm';

export type ScheduleConflictLockInput = {
  teacherId: number;
  groupId: number;
  dayOfWeek: number;
  timeSlotId: number;
};

/** Build lexicographically sortable named-lock keys for teacher + group resources. */
export function buildScheduleConflictLockKeys(
  input: ScheduleConflictLockInput,
): string[] {
  const teacherKey = `edusmart:sched:t:${input.teacherId}:${input.dayOfWeek}:${input.timeSlotId}`;
  const groupKey = `edusmart:sched:g:${input.groupId}:${input.dayOfWeek}:${input.timeSlotId}`;
  return [teacherKey, groupKey].sort();
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

/**
 * Acquire MySQL named locks on the QueryRunner connection (sorted order).
 * Does NOT release — caller must release after COMMIT (or after ROLLBACK on error).
 */
export async function acquireScheduleConflictLocks(
  queryRunner: QueryRunner,
  input: ScheduleConflictLockInput,
  timeoutSeconds = 10,
): Promise<string[]> {
  const keys = buildScheduleConflictLockKeys(input);
  const acquired: string[] = [];

  try {
    for (const key of keys) {
      const rows = await queryRunner.query(
        'SELECT GET_LOCK(?, ?) AS acquired',
        [key, timeoutSeconds],
      );
      const result = readLockResult(rows);

      if (result === 1) {
        acquired.push(key);
        continue;
      }

      if (result === 0) {
        throw new ServiceUnavailableException({
          code: 'SCHEDULE_LOCK_TIMEOUT',
          message: 'Could not acquire schedule conflict lock; retry later',
          lockKey: key,
        });
      }

      throw new ServiceUnavailableException({
        code: 'SCHEDULE_LOCK_ERROR',
        message: 'Named lock acquisition failed (NULL/error from GET_LOCK)',
        lockKey: key,
      });
    }
    return acquired;
  } catch (error) {
    // Second lock failed → release any already held on this connection.
    try {
      await releaseScheduleConflictLocks(queryRunner, acquired);
    } catch {
      // preserve primary GET_LOCK error
    }
    throw error;
  }
}

/**
 * Best-effort RELEASE_LOCK for keys acquired on this QueryRunner connection.
 * Prefer reverse acquisition order. Never throws for anomalous RELEASE results;
 * only rethrows if no prior business error and release itself throws unexpectedly.
 */
export async function releaseScheduleConflictLocks(
  queryRunner: QueryRunner,
  acquiredKeys: string[],
): Promise<void> {
  const keys = [...acquiredKeys].reverse();
  const errors: unknown[] = [];

  for (const key of keys) {
    try {
      await queryRunner.query('SELECT RELEASE_LOCK(?) AS released', [key]);
      // 1 = released, 0 = not owned by this connection, NULL = unknown — all best-effort
    } catch (error) {
      errors.push(error);
    }
  }

  if (errors.length > 0) {
    // Surface only if caller has no primary error to propagate.
    throw errors[0];
  }
}

export class ScheduleTeacherConflictException extends ConflictException {
  constructor(details?: Record<string, unknown>) {
    super({
      code: 'SCHEDULE_TEACHER_CONFLICT',
      message:
        'Teacher already has a schedule entry for this day and time slot',
      ...details,
    });
  }
}

export class ScheduleGroupConflictException extends ConflictException {
  constructor(details?: Record<string, unknown>) {
    super({
      code: 'SCHEDULE_GROUP_CONFLICT',
      message: 'Group already has a schedule entry for this day and time slot',
      ...details,
    });
  }
}

export class ScheduleEntryDuplicateException extends ConflictException {
  constructor(details?: Record<string, unknown>) {
    super({
      code: 'SCHEDULE_ENTRY_DUPLICATE',
      message:
        'This teaching assignment is already scheduled for this day and time slot',
      ...details,
    });
  }
}

/** Historical protection: occurrence run is referenced by AttendanceSession(s). */
export class ScheduleOccurrenceInUseException extends ConflictException {
  constructor(details?: Record<string, unknown>) {
    super({
      code: 'SCHEDULE_OCCURRENCE_IN_USE',
      message:
        'This schedule occurrence is linked to attendance and cannot be changed',
      ...details,
    });
  }
}
