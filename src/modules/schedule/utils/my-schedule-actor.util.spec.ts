import { resolveMyScheduleActorKind } from './my-schedule-actor.util';

describe('resolveMyScheduleActorKind (E1)', () => {
  it('Docente → teacher', () => {
    expect(resolveMyScheduleActorKind(['Docente'])).toBe('teacher');
  });

  it('TEACHER enum → teacher', () => {
    expect(resolveMyScheduleActorKind(['TEACHER'])).toBe('teacher');
  });

  it('Estudiante → student', () => {
    expect(resolveMyScheduleActorKind(['Estudiante'])).toBe('student');
  });

  it('Docente + Estudiante → teacher (prioridad)', () => {
    expect(resolveMyScheduleActorKind(['Estudiante', 'Docente'])).toBe(
      'teacher',
    );
  });

  it('ADMIN → teacher (own TA scope, never global)', () => {
    expect(resolveMyScheduleActorKind(['ADMIN'])).toBe('teacher');
    expect(resolveMyScheduleActorKind(['Administrador'])).toBe('teacher');
  });

  it('roles no soportados → unsupported', () => {
    expect(resolveMyScheduleActorKind([])).toBe('unsupported');
    expect(resolveMyScheduleActorKind(['Guardian'])).toBe('unsupported');
  });
});
