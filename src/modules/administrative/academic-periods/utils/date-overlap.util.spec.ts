import { datesOverlap } from './date-overlap.util';

describe('datesOverlap', () => {
  it('returns false when ranges are adjacent without overlap', () => {
    expect(datesOverlap('2026-01-01', '2026-03-31', '2026-04-01', '2026-06-30')).toBe(false);
  });

  it('returns true when ranges partially overlap', () => {
    expect(datesOverlap('2026-01-01', '2026-04-15', '2026-04-01', '2026-06-30')).toBe(true);
  });

  it('returns true when one range is fully inside another', () => {
    expect(datesOverlap('2026-01-01', '2026-12-31', '2026-03-01', '2026-03-31')).toBe(true);
  });

  it('returns true when ranges share an endpoint day', () => {
    expect(datesOverlap('2026-01-01', '2026-03-31', '2026-03-31', '2026-06-30')).toBe(true);
  });

  it('returns true when ranges are identical', () => {
    expect(datesOverlap('2026-02-01', '2026-06-30', '2026-02-01', '2026-06-30')).toBe(true);
  });

  it('returns false when first range is completely before second', () => {
    expect(datesOverlap('2025-01-01', '2025-06-30', '2026-01-01', '2026-06-30')).toBe(false);
  });
});
