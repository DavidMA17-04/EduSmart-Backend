import { composeOwnSectionLabel } from './user-public.mapper';

describe('composeOwnSectionLabel', () => {
  it('compone nivel-grupo cuando el nombre no trae el grado', () => {
    expect(composeOwnSectionLabel(10, 'A')).toBe('10-A');
  });

  it('no duplica el grado si el grupo ya lo incluye', () => {
    expect(composeOwnSectionLabel(10, '10-A')).toBe('10-A');
  });
});
