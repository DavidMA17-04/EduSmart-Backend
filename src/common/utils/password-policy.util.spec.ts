import {
  generateCompliantPassword,
  isStrongPassword,
  STRONG_PASSWORD_REGEX,
} from './password-policy.util';

describe('password-policy.util', () => {
  it('acepta una contraseña fuerte', () => {
    expect(isStrongPassword('Secret1!')).toBe(true);
    expect(STRONG_PASSWORD_REGEX.test('Abcd1234!')).toBe(true);
  });

  it('rechaza contraseñas débiles', () => {
    expect(isStrongPassword('secret12')).toBe(false);
    expect(isStrongPassword('SECRET12')).toBe(false);
    expect(isStrongPassword('Secret!!')).toBe(false);
    expect(isStrongPassword('Secret12')).toBe(false);
    expect(isStrongPassword('short1!')).toBe(false);
  });

  it('genera contraseñas que cumplen la política', () => {
    for (let i = 0; i < 20; i += 1) {
      expect(isStrongPassword(generateCompliantPassword())).toBe(true);
    }
  });
});
