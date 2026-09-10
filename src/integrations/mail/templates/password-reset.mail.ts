import { MAIL_BRAND } from '../mail-brand.constants';
import { escapeHtml } from '../mail-html.util';
import { renderInstitutionalMailLayout } from './institutional-mail.layout';
import type { BuiltMail } from './account-verification.mail';

export type PasswordResetMailInput = {
  email: string;
  resetUrl: string;
  /** Minutes of validity (display only; policy stays in PASSWORD_RESET). */
  validMinutes: number;
  includeLogo?: boolean;
};

export function buildPasswordResetMail(input: PasswordResetMailInput): BuiltMail {
  const includeLogo = Boolean(input.includeLogo);
  const safeEmail = escapeHtml(input.email);
  const safeUrl = escapeHtml(input.resetUrl);
  const minutes = input.validMinutes;

  const bodyHtml = `
    <p style="margin:0 0 12px 0;font-size:15px;line-height:1.55;text-align:center;color:${MAIL_BRAND.text};">
      Recibimos una solicitud para restablecer la contraseña de su cuenta en
      <strong style="color:${MAIL_BRAND.navy};">${MAIL_BRAND.productName}</strong>.
    </p>
    <p style="margin:0 0 20px 0;font-size:13px;line-height:1.5;text-align:center;color:${MAIL_BRAND.muted};">
      Enviado a: <strong style="color:${MAIL_BRAND.navy};">${safeEmail}</strong>
    </p>
    <p style="margin:0 0 16px 0;font-size:13px;line-height:1.55;text-align:center;color:${MAIL_BRAND.muted};">
      El enlace es válido por <strong style="color:${MAIL_BRAND.navy};">${minutes} minutos</strong>.
    </p>
    <p style="margin:0 0 8px 0;font-family:${MAIL_BRAND.fontSans};font-size:13px;line-height:1.55;color:${MAIL_BRAND.muted};text-align:center;">
      Si el botón no funciona, abra este enlace:<br />
      <a href="${escapeAttr(input.resetUrl)}" style="color:${MAIL_BRAND.primary};word-break:break-all;">${safeUrl}</a>
    </p>
    <p style="margin:12px 0 0 0;font-family:${MAIL_BRAND.fontSans};font-size:12px;line-height:1.5;color:${MAIL_BRAND.muted};text-align:center;">
      Si no solicitó este cambio, ignore este mensaje.
    </p>
  `;

  const html = renderInstitutionalMailLayout({
    preheader: `Restablezca su contraseña de EduSmart. El enlace vence en ${minutes} minutos.`,
    title: 'Restablecer contraseña',
    bodyHtml,
    ctaLabel: 'Restablecer contraseña',
    ctaUrl: input.resetUrl,
    includeLogo,
  });

  const text = [
    `Restablecer contraseña — ${MAIL_BRAND.productName} ${MAIL_BRAND.institutionShort}`,
    '',
    `Enviado a: ${input.email}`,
    '',
    'Recibimos una solicitud para restablecer su contraseña de EduSmart.',
    '',
    `Abra este enlace (válido por ${minutes} minutos): ${input.resetUrl}`,
    '',
    'Si no solicitó este cambio, ignore este mensaje.',
    '',
    MAIL_BRAND.institutionName,
    MAIL_BRAND.ministry,
  ].join('\n');

  return {
    subject: `Restablecer contraseña — ${MAIL_BRAND.productName} ${MAIL_BRAND.institutionShort}`,
    text,
    html,
  };
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
