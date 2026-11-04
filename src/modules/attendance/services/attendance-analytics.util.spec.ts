import { AttendanceStatus } from '../../../common/enums/attendance-status.enum';
import {
  asNumber,
  costaRicaTodayIso,
  presentismoRate,
  roundRate,
} from './attendance-analytics.util';

describe('attendance-analytics.util', () => {
  it('asNumber parses MySQL decimal strings', () => {
    expect(asNumber('12.50')).toBe(12.5);
    expect(asNumber(3)).toBe(3);
    expect(asNumber(null)).toBe(0);
    expect(asNumber('')).toBe(0);
  });

  it('presentismoRate uses PRESENT+LATE and avoids divide-by-zero', () => {
    expect(presentismoRate(8, 2, 10)).toBe(100);
    expect(presentismoRate(7, 1, 10)).toBe(80);
    expect(presentismoRate(0, 0, 0)).toBe(0);
  });

  it('roundRate keeps two decimals', () => {
    expect(roundRate(33.333)).toBe(33.33);
    expect(roundRate(Number.NaN)).toBe(0);
  });

  it('costaRicaTodayIso returns YYYY-MM-DD', () => {
    expect(costaRicaTodayIso(new Date('2026-09-23T05:00:00.000Z'))).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });

  it('status enum used by aggregations includes JUSTIFIED', () => {
    expect(Object.values(AttendanceStatus)).toEqual([
      'PRESENT',
      'ABSENT',
      'LATE',
      'JUSTIFIED',
    ]);
  });
});
