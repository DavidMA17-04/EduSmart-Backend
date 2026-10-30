import { actorSeesFullAcademicHistory } from './academic-visibility.util';

describe('actorSeesFullAcademicHistory', () => {
  it('Administrador ve ciclos anteriores', () => {
    expect(actorSeesFullAcademicHistory(['Administrador'])).toBe(true);
    expect(actorSeesFullAcademicHistory(['ADMIN'])).toBe(true);
  });

  it('Director ve ciclos anteriores', () => {
    expect(actorSeesFullAcademicHistory(['Director'])).toBe(true);
  });

  it('Docente, Orientador y Estudiante no ven historial', () => {
    expect(actorSeesFullAcademicHistory(['Docente'])).toBe(false);
    expect(actorSeesFullAcademicHistory(['TEACHER'])).toBe(false);
    expect(actorSeesFullAcademicHistory(['Orientador'])).toBe(false);
    expect(actorSeesFullAcademicHistory(['Estudiante'])).toBe(false);
    expect(actorSeesFullAcademicHistory(['Encargado'])).toBe(false);
  });

  it('Director+Docente conserva el historial', () => {
    expect(actorSeesFullAcademicHistory(['Director', 'Docente'])).toBe(true);
  });
});
