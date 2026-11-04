export const PASSWORD_RESET = {
  TTL_MS: 60 * 60 * 1000,
  GENERIC_MESSAGE:
    'Si el correo está registrado, enviamos un enlace para restablecer la contraseña.',
} as const;

export const SESSION_MESSAGES = {
  LOGGED_OUT: 'Sesión cerrada.',
  REVOKED: 'Sesión invalidada.',
  ALL_REVOKED: 'Todas las sesiones fueron cerradas.',
} as const;
