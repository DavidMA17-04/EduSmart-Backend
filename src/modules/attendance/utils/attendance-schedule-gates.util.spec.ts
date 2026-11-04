import { isAttendanceScheduleGatesRelaxed } from './attendance-schedule-gates.util';

describe('isAttendanceScheduleGatesRelaxed', () => {
  const prevGate = process.env.ATTENDANCE_RELAX_SCHEDULE_GATES;
  const prevNode = process.env.NODE_ENV;

  afterEach(() => {
    if (prevGate === undefined) delete process.env.ATTENDANCE_RELAX_SCHEDULE_GATES;
    else process.env.ATTENDANCE_RELAX_SCHEDULE_GATES = prevGate;
    process.env.NODE_ENV = prevNode;
  });

  it('explicit true', () => {
    process.env.ATTENDANCE_RELAX_SCHEDULE_GATES = 'true';
    process.env.NODE_ENV = 'production';
    expect(isAttendanceScheduleGatesRelaxed()).toBe(true);
  });

  it('explicit false wins over development', () => {
    process.env.ATTENDANCE_RELAX_SCHEDULE_GATES = 'false';
    process.env.NODE_ENV = 'development';
    expect(isAttendanceScheduleGatesRelaxed()).toBe(false);
  });

  it('development defaults to relaxed', () => {
    delete process.env.ATTENDANCE_RELAX_SCHEDULE_GATES;
    process.env.NODE_ENV = 'development';
    expect(isAttendanceScheduleGatesRelaxed()).toBe(true);
  });

  it('test defaults to strict', () => {
    delete process.env.ATTENDANCE_RELAX_SCHEDULE_GATES;
    process.env.NODE_ENV = 'test';
    expect(isAttendanceScheduleGatesRelaxed()).toBe(false);
  });
});
