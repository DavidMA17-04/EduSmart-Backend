import { ServiceUnavailableException } from '@nestjs/common';
import {
  acquireScheduleConflictLocks,
  buildScheduleConflictLockKeys,
  releaseScheduleConflictLocks,
} from './schedule-locks.util';

describe('schedule-locks.util', () => {
  function mockRunner(getLockResults: Array<number | null>) {
    const queries: Array<{ sql: string; params?: unknown[] }> = [];
    let getIdx = 0;
    const queryRunner = {
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        queries.push({ sql, params });
        if (sql.includes('GET_LOCK')) {
          const value = getLockResults[getIdx++] ?? null;
          return [{ acquired: value }];
        }
        if (sql.includes('RELEASE_LOCK')) {
          return [{ released: 1 }];
        }
        return [];
      }),
    };
    return { queryRunner, queries };
  }

  it('1. GET_LOCK success → 1', async () => {
    const { queryRunner } = mockRunner([1, 1]);
    const keys = await acquireScheduleConflictLocks(queryRunner as never, {
      teacherId: 10,
      groupId: 1,
      dayOfWeek: 1,
      timeSlotId: 1,
    });
    expect(keys).toHaveLength(2);
    expect(keys).toEqual(
      buildScheduleConflictLockKeys({
        teacherId: 10,
        groupId: 1,
        dayOfWeek: 1,
        timeSlotId: 1,
      }),
    );
  });

  it('2. GET_LOCK timeout → 0 => SCHEDULE_LOCK_TIMEOUT', async () => {
    const { queryRunner } = mockRunner([0]);
    try {
      await acquireScheduleConflictLocks(queryRunner as never, {
        teacherId: 10,
        groupId: 1,
        dayOfWeek: 1,
        timeSlotId: 1,
      });
      throw new Error('expected rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as ServiceUnavailableException).getResponse()).toMatchObject({
        code: 'SCHEDULE_LOCK_TIMEOUT',
      });
    }
  });

  it('3. GET_LOCK NULL => SCHEDULE_LOCK_ERROR', async () => {
    const { queryRunner } = mockRunner([null]);
    try {
      await acquireScheduleConflictLocks(queryRunner as never, {
        teacherId: 10,
        groupId: 1,
        dayOfWeek: 1,
        timeSlotId: 1,
      });
      throw new Error('expected rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as ServiceUnavailableException).getResponse()).toMatchObject({
        code: 'SCHEDULE_LOCK_ERROR',
      });
    }
  });

  it('8. dos locks: orden lexicográfico (g antes que t)', () => {
    const keys = buildScheduleConflictLockKeys({
      teacherId: 10,
      groupId: 1,
      dayOfWeek: 1,
      timeSlotId: 5,
    });
    expect(keys[0]).toBe('edusmart:sched:g:1:1:5');
    expect(keys[1]).toBe('edusmart:sched:t:10:1:5');
  });

  it('9. release en orden inverso', async () => {
    const { queryRunner, queries } = mockRunner([]);
    await releaseScheduleConflictLocks(queryRunner as never, [
      'edusmart:sched:g:1:1:5',
      'edusmart:sched:t:10:1:5',
    ]);
    const releases = queries.filter((q) => q.sql.includes('RELEASE_LOCK'));
    expect(releases.map((q) => q.params?.[0])).toEqual([
      'edusmart:sched:t:10:1:5',
      'edusmart:sched:g:1:1:5',
    ]);
  });

  it('10. primer GET_LOCK OK, segundo falla → liberar el primero', async () => {
    const { queryRunner, queries } = mockRunner([1, 0]);
    await expect(
      acquireScheduleConflictLocks(queryRunner as never, {
        teacherId: 10,
        groupId: 1,
        dayOfWeek: 1,
        timeSlotId: 1,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    const releases = queries.filter((q) => q.sql.includes('RELEASE_LOCK'));
    expect(releases).toHaveLength(1);
    expect(releases[0].params?.[0]).toBe('edusmart:sched:g:1:1:1');
  });
});
