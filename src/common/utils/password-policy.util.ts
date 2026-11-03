import { randomInt } from 'crypto';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;
export const PASSWORD_SPECIAL_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?';

/** Mayúscula, minúscula, dígito y especial; longitud 8–72. */
export const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{}|;:,.<>?])[\s\S]{8,72}$/;

export const STRONG_PASSWORD_MESSAGE =
  'La contraseña debe tener entre 8 y 72 caracteres, e incluir mayúscula, minúscula, número y un carácter especial.';

export function isStrongPassword(value: string): boolean {
  return STRONG_PASSWORD_REGEX.test(value);
}

function pickRandom(chars: string): string {
  return chars[randomInt(chars.length)] ?? chars[0] ?? 'a';
}

function shuffle(chars: string[]): string[] {
  const next = [...chars];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    const tmp = next[i]!;
    next[i] = next[j]!;
    next[j] = tmp;
  }
  return next;
}

/** Contraseña temporal que cumple la política institucional. */
export function generateCompliantPassword(length = 12): string {
  const size = Math.max(PASSWORD_MIN_LENGTH, Math.min(PASSWORD_MAX_LENGTH, length));
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  const special = PASSWORD_SPECIAL_CHARS;
  const all = `${lower}${upper}${digits}${special}`;

  const required = [
    pickRandom(lower),
    pickRandom(upper),
    pickRandom(digits),
    pickRandom(special),
  ];

  while (required.length < size) {
    required.push(pickRandom(all));
  }

  return shuffle(required).join('');
}
