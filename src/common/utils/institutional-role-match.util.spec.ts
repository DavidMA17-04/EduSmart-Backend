import { Role } from '../enums/role.enum';
import { institutionalRoleMatches } from './institutional-role-match.util';

describe('institutionalRoleMatches', () => {
  it('JWT Estudiante pasa @Roles(STUDENT)', () => {
    expect(institutionalRoleMatches(['Estudiante'], [Role.STUDENT])).toBe(true);
  });

  it('JWT Docente no pasa @Roles(STUDENT)', () => {
    expect(institutionalRoleMatches(['Docente'], [Role.STUDENT])).toBe(false);
  });

  it('ADMIN y Administrador equivalen', () => {
    expect(institutionalRoleMatches(['ADMIN'], [Role.ADMIN])).toBe(true);
    expect(institutionalRoleMatches(['Administrador'], [Role.ADMIN])).toBe(true);
  });

  it('Docente equivale a TEACHER y Orientador a COUNSELOR', () => {
    expect(institutionalRoleMatches(['Docente'], [Role.TEACHER])).toBe(true);
    expect(institutionalRoleMatches(['TEACHER'], [Role.TEACHER])).toBe(true);
    expect(institutionalRoleMatches(['Orientador'], [Role.COUNSELOR])).toBe(true);
    expect(institutionalRoleMatches(['COUNSELOR'], [Role.COUNSELOR])).toBe(true);
  });

  it('Padre de familia equivale a GUARDIAN', () => {
    expect(
      institutionalRoleMatches(['Padre de familia'], [Role.GUARDIAN]),
    ).toBe(true);
    expect(institutionalRoleMatches(['Encargado'], [Role.GUARDIAN])).toBe(true);
  });

  it('Director se reconoce por nombre institucional', () => {
    expect(institutionalRoleMatches(['Director'], ['Director'])).toBe(true);
    expect(institutionalRoleMatches(['Docente'], ['Director'])).toBe(false);
  });
});
