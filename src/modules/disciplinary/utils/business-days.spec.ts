import { addBusinessDays, addNaturalDays, businessDaysBetween, institutionalToday, isBusinessDay } from './business-days';

describe('días hábiles disciplinarios', () => {
  it('sábado y domingo no son hábiles', () => {
    expect(isBusinessDay('2026-10-17')).toBe(false);
    expect(isBusinessDay('2026-10-18')).toBe(false);
    expect(isBusinessDay('2026-10-19')).toBe(true);
  });

  it('el plazo corre desde el día hábil siguiente y salta el fin de semana', () => {
    expect(addBusinessDays('2026-10-14', 5)).toBe('2026-10-21');
    expect(addBusinessDays('2026-10-16', 1)).toBe('2026-10-19');
    expect(businessDaysBetween('2026-10-14', '2026-10-21')).toBe(5);
  });

  it('un feriado institucional no cuenta como hábil', () => {
    const holidays = new Set(['2026-10-19']);
    expect(addBusinessDays('2026-10-16', 1, holidays)).toBe('2026-10-20');
    expect(businessDaysBetween('2026-10-16', '2026-10-20', holidays)).toBe(1);
  });

  it('cruza de mes', () => {
    expect(addBusinessDays('2026-10-29', 3)).toBe('2026-11-03');
    expect(addNaturalDays('2026-10-25', 10)).toBe('2026-11-04');
    expect(businessDaysBetween('2026-10-29', '2026-11-03')).toBe(3);
  });

  it('la fecha de hoy sale en America/Costa_Rica', () => {
    expect(institutionalToday(new Date('2026-03-12T02:30:00.000Z'))).toBe('2026-03-11');
  });
});
