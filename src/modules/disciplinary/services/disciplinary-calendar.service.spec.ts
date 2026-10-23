import { ConflictException } from '@nestjs/common';
import { DisciplinaryCalendarService } from './disciplinary-calendar.service';

describe('DisciplinaryCalendarService', () => {
  it('registra un día no hábil y lo audita', async () => {
    const saved: unknown[] = [];
    const audits: unknown[] = [];
    const service = build({
      days: {
        findOne: async () => null,
        create: (value: unknown) => value,
        save: async (value: Record<string, unknown>) => {
          const row = { id: 4, ...value };
          saved.push(row);
          return row;
        },
      },
      audit: {
        create: (value: unknown) => value,
        save: async (value: unknown) => {
          audits.push(value);
          return value;
        },
      },
    });
    const created = await service.createDay({ id: 1 } as never, { day: '2026-12-25', reason: 'Navidad' });
    expect(created).toEqual({ id: 4, day: '2026-12-25', reason: 'Navidad', authorUserId: 1 });
    expect(audits).toEqual([
      expect.objectContaining({ action: 'NON_WORKING_DAY_CREATE', entity: 'non_working_days', entityId: '4' }),
    ]);
  });

  it('rechaza un día duplicado', async () => {
    const service = build({
      days: { findOne: async () => ({ id: 1, day: '2026-12-25' }) },
    });
    await expect(
      service.createDay({ id: 1 } as never, { day: '2026-12-25', reason: 'Otra navidad' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('actualiza los umbrales y conserva el registro anterior en la auditoría', async () => {
    const audits: Array<{ before: unknown; after: unknown }> = [];
    const current = { id: 1, recidivismThreshold: 3, conductAlertThreshold: 80 };
    const service = build({
      settings: {
        findOne: async () => current,
        save: async (value: typeof current) => value,
      },
      audit: {
        create: (value: { before: unknown; after: unknown }) => value,
        save: async (value: { before: unknown; after: unknown }) => {
          audits.push(value);
          return value;
        },
      },
    });
    const updated = await service.updateSettings({ id: 1 } as never, {
      recidivismThreshold: 4,
      conductAlertThreshold: 75,
    });
    expect(updated).toEqual({ recidivismThreshold: 4, conductAlertThreshold: 75 });
    expect(audits[0].before).toEqual({ recidivismThreshold: 3, conductAlertThreshold: 80 });
    expect(audits[0].after).toEqual(updated);
  });
});

function build(hooks: {
  days?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  audit?: Record<string, unknown>;
}) {
  return new DisciplinaryCalendarService(
    (hooks.days ?? {}) as never,
    (hooks.settings ?? {}) as never,
    (hooks.audit ?? { create: (value: unknown) => value, save: async (value: unknown) => value }) as never,
  );
}
