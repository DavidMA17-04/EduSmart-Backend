import { composeSectionLabel } from './section-label.util';

describe('composeSectionLabel', () => {
  it('no duplica el nivel cuando el grupo ya lo incluye', () => {
    expect(composeSectionLabel(10, '10-1')).toBe('10-1');
    expect(composeSectionLabel(10, 'A')).toBe('10-A');
    expect(composeSectionLabel(10, '10')).toBe('10');
    expect(composeSectionLabel(10, 'D4-10-A')).toBe('D4-10-A');
    expect(composeSectionLabel(null, 'D4-10-A')).toBe('D4-10-A');
  });
});
