import {
  calendarDateInTimeZone,
  isWithinScheduleStartWindow,
  localClockInTimeZone,
  subtractMinutesFromTime,
} from './business-calendar-date.util';

describe('calendarDateInTimeZone (America/Costa_Rica)', () => {
  it('UTC morning can be previous calendar day in CR', () => {
    // 2026-03-12T02:30:00.000Z = 2026-03-11 20:30 in America/Costa_Rica (UTC-6)
    const instant = new Date('2026-03-12T02:30:00.000Z');
    expect(calendarDateInTimeZone(instant)).toBe('2026-03-11');
  });

  it('keeps same calendar day during CR daytime', () => {
    const instant = new Date('2026-03-11T18:00:00.000Z');
    expect(calendarDateInTimeZone(instant)).toBe('2026-03-11');
  });
});

describe('localClockInTimeZone / window helpers (F)', () => {
  it('maps Monday in CR to dayOfWeek=1', () => {
    // 2026-09-14 is a Monday; 15:00 UTC = 09:00 CR
    const clock = localClockInTimeZone(new Date('2026-09-14T15:00:00.000Z'));
    expect(clock.date).toBe('2026-09-14');
    expect(clock.dayOfWeek).toBe(1);
    expect(clock.time).toBe('09:00:00');
  });

  it('subtractMinutesFromTime and inclusive window', () => {
    expect(subtractMinutesFromTime('07:00:00', 10)).toBe('06:50:00');
    expect(isWithinScheduleStartWindow('07:00:00', '08:20:00', '06:50:00')).toBe(
      true,
    );
    expect(isWithinScheduleStartWindow('07:00:00', '08:20:00', '06:49:59')).toBe(
      false,
    );
    expect(isWithinScheduleStartWindow('07:00:00', '08:20:00', '07:30:00')).toBe(
      true,
    );
    expect(isWithinScheduleStartWindow('07:00:00', '08:20:00', '08:20:00')).toBe(
      true,
    );
    expect(isWithinScheduleStartWindow('07:00:00', '08:20:00', '08:20:01')).toBe(
      false,
    );
  });
});
