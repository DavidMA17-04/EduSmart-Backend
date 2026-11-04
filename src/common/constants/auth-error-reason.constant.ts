/** Stable login error reasons returned in the error envelope `data` field. */
export const AUTH_ERROR_REASON = {
  ACCOUNT_PENDING: 'ACCOUNT_PENDING',
} as const;

export type AuthErrorReason = (typeof AUTH_ERROR_REASON)[keyof typeof AUTH_ERROR_REASON];

export const ACCOUNT_PENDING_LOGIN_MESSAGE =
  'La cuenta está pendiente de verificación. Revise su correo o solicite un código nuevo.';
