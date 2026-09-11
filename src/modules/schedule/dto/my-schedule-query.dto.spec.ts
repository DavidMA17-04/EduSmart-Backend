import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MyScheduleQueryDto } from './my-schedule-query.dto';

describe('MyScheduleQueryDto', () => {
  it('acepta periodId y dayOfWeek', async () => {
    const dto = plainToInstance(MyScheduleQueryDto, {
      periodId: '1',
      dayOfWeek: '3',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.periodId).toBe(1);
    expect(dto.dayOfWeek).toBe(3);
  });

  it('dayOfWeek fuera de 1–5 inválido', async () => {
    const dto = plainToInstance(MyScheduleQueryDto, { dayOfWeek: 6 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('teacherId/groupId/userId no están whitelisted (forbidNonWhitelisted)', async () => {
    const dto = plainToInstance(MyScheduleQueryDto, {
      periodId: 1,
      dayOfWeek: 2,
      teacherId: 999,
      groupId: 3,
      userId: 1,
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors.length).toBeGreaterThan(0);
    const messages = errors.flatMap((e) => Object.values(e.constraints ?? {}));
    expect(messages.some((m) => /property teacherId should not exist/i.test(m))).toBe(
      true,
    );
  });
});
