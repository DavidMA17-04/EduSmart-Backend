import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  acquireScheduleTimeSlotsMutateLock,
  assertLessonNumberForSlotType,
  assertScheduleTimeSlotRange,
  normalizeScheduleTimeInput,
  releaseScheduleTimeSlotsMutateLock,
  scheduleTimesOverlap,
  SCHEDULE_TIME_SLOTS_MUTATE_LOCK_KEY,
} from './schedule-time-slot-mutations.util';
import { ScheduleSlotType } from '../../../common/enums/schedule-slot-type.enum';

describe('schedule-time-slot-mutations.util', () => {
  it('normaliza HH:mm → HH:mm:ss', () => {
    expect(normalizeScheduleTimeInput('07:00')).toBe('07:00:00');
    expect(normalizeScheduleTimeInput('07:40:00')).toBe('07:40:00');
  });

  it('5. bordes iguales no se solapan', () => {
    expect(
      scheduleTimesOverlap('07:00:00', '07:40:00', '07:40:00', '08:20:00'),
    ).toBe(false);
  });

  it('overlap real CLASS–CLASS', () => {
    expect(
      scheduleTimesOverlap('07:00:00', '07:40:00', '07:20:00', '08:00:00'),
    ).toBe(true);
  });

  it('assert range start >= end', () => {
    expect(() =>
      assertScheduleTimeSlotRange('08:00:00', '07:00:00'),
    ).toThrow(BadRequestException);
    expect(() =>
      assertScheduleTimeSlotRange('08:00:00', '08:00:00'),
    ).toThrow(BadRequestException);
  });

  it('23–24. BREAK/LUNCH + lessonNumber inválido', () => {
    expect(() =>
      assertLessonNumberForSlotType(ScheduleSlotType.BREAK, 1),
    ).toThrow(BadRequestException);
    expect(() =>
      assertLessonNumberForSlotType(ScheduleSlotType.LUNCH, 2),
    ).toThrow(BadRequestException);
  });

  it('25/29. CLASS lessonNumber permitido o null', () => {
    expect(assertLessonNumberForSlotType(ScheduleSlotType.CLASS, 1)).toBe(1);
    expect(assertLessonNumberForSlotType(ScheduleSlotType.CLASS, null)).toBe(
      null,
    );
  });

  it('38. named lock key global exacta', () => {
    expect(SCHEDULE_TIME_SLOTS_MUTATE_LOCK_KEY).toBe(
      'edusmart:sched:time-slots:mutate',
    );
  });

  describe('named lock lifecycle helpers', () => {
    function mockRunner(getLockResult: number | null) {
      const queries: Array<{ sql: string; params?: unknown[] }> = [];
      const queryRunner = {
        query: jest.fn(async (sql: string, params?: unknown[]) => {
          queries.push({ sql, params });
          if (sql.includes('GET_LOCK')) {
            return [{ acquired: getLockResult }];
          }
          if (sql.includes('RELEASE_LOCK')) {
            return [{ released: 1 }];
          }
          return [];
        }),
      };
      return { queryRunner, queries };
    }

    it('30. GET_LOCK success', async () => {
      const { queryRunner, queries } = mockRunner(1);
      await expect(
        acquireScheduleTimeSlotsMutateLock(queryRunner as never),
      ).resolves.toBe(SCHEDULE_TIME_SLOTS_MUTATE_LOCK_KEY);
      expect(queries[0].params?.[0]).toBe(SCHEDULE_TIME_SLOTS_MUTATE_LOCK_KEY);
      expect(queries[0].params?.[1]).toBe(10);
    });

    it('31. GET_LOCK 0 → timeout', async () => {
      const { queryRunner } = mockRunner(0);
      try {
        await acquireScheduleTimeSlotsMutateLock(queryRunner as never);
        throw new Error('expected rejection');
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceUnavailableException);
        expect(
          (error as ServiceUnavailableException).getResponse(),
        ).toMatchObject({ code: 'SCHEDULE_TIME_SLOT_LOCK_TIMEOUT' });
      }
    });

    it('32. GET_LOCK NULL → lock error', async () => {
      const { queryRunner } = mockRunner(null);
      try {
        await acquireScheduleTimeSlotsMutateLock(queryRunner as never);
        throw new Error('expected rejection');
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceUnavailableException);
        expect(
          (error as ServiceUnavailableException).getResponse(),
        ).toMatchObject({ code: 'SCHEDULE_TIME_SLOT_LOCK_ERROR' });
      }
    });

    it('release usa misma key', async () => {
      const { queryRunner, queries } = mockRunner(1);
      await releaseScheduleTimeSlotsMutateLock(queryRunner as never);
      expect(queries[0].params?.[0]).toBe(SCHEDULE_TIME_SLOTS_MUTATE_LOCK_KEY);
    });
  });
});
