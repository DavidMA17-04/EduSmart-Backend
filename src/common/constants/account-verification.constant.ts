/** Centralized PBI-16 verification policy (no magic numbers in call sites). */
export const ACCOUNT_VERIFICATION = {
  CODE_LENGTH: 6,
  CODE_MAX: 1_000_000,
  TTL_MS: 5 * 60 * 1000,
  MAX_ATTEMPTS: 5,
  RESEND_COOLDOWN_MS: 60 * 1000,
  MAX_RESENDS_PER_HOUR: 5,
} as const;

export const VERIFICATION_GENERIC_VERIFY_ERROR =
  'No se pudo verificar la cuenta. Revise el correo y el código, o solicite uno nuevo.';

export const VERIFICATION_GENERIC_SUCCESS =
  'Cuenta verificada. Ya puede iniciar sesión.';

export const VERIFICATION_GENERIC_RESEND =
  'Si la cuenta requiere verificación, enviamos un nuevo código al correo indicado.';
