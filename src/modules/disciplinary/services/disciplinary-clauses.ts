import { SmtpNotConfiguredError } from '../../../integrations/mail/mail.service';
import { NotificationEmailStatus } from '../constants/disciplinary.enums';

/** Textos que el servidor agrega siempre. El cliente no puede omitirlos. */
export const MANDATORY_CLAUSES = [
  'Tiene derecho a conocer y acceder al expediente disciplinario en cualquier momento del proceso.',
  'Tiene derecho a hacerse acompañar y asesorar por un abogado.',
] as const;

export function withMandatoryClauses(body: string): string {
  const clauses = MANDATORY_CLAUSES.map((clause, index) => `${index + 1}. ${clause}`).join('\n');
  return `${body.trim()}\n\n${clauses}`;
}

export function emailStatusFor(error: unknown): NotificationEmailStatus {
  if (error instanceof SmtpNotConfiguredError) return NotificationEmailStatus.SKIPPED;
  return NotificationEmailStatus.FAILED;
}
