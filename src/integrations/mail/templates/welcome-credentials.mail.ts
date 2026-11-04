import { MAIL_BRAND } from '../mail-brand.constants';
import { escapeHtml } from '../mail-html.util';
import { renderInstitutionalMailLayout } from './institutional-mail.layout';
import type { BuiltMail } from './account-verification.mail';

export type WelcomeCredentialsMailInput = {
  email: string;
  fullName: string;
  temporaryPassword: string;
  loginUrl: string;
  includeLogo?: boolean;
};

export function buildWelcomeCredentialsMail(input: WelcomeCredentialsMailInput): BuiltMail {
  const includeLogo = Boolean(input.includeLogo);
  const safeEmail = escapeHtml(input.email);
  const safeName = escapeHtml(input.fullName);
  const safePassword = escapeHtml(input.temporaryPassword);
  const safeUrl = escapeHtml(input.loginUrl);

  const bodyHtml = `
    <p style="margin:0 0 12px 0;font-size:15px;line-height:1.55;text-align:center;color:${MAIL_BRAND.text};">
      Hola <strong style="color:${MAIL_BRAND.navy};">${safeName}</strong>,
      bienvenido(a) a
      <strong style="color:${MAIL_BRAND.navy};">${MAIL_BRAND.productName}</strong>.
    </p>
    <p style="margin:0 0 20px 0;font-size:13px;line-height:1.5;text-align:center;color:${MAIL_BRAND.muted};">
      Se creó su cuenta institucional. Use estas credenciales temporales para el primer acceso.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td align="center" style="padding:4px 0 8px 0;font-family:${MAIL_BRAND.fontSans};font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${MAIL_BRAND.muted};">
          Correo de acceso
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:0 0 16px 0;font-family:${MAIL_BRAND.fontSans};font-size:15px;font-weight:600;color:${MAIL_BRAND.navy};">
          ${safeEmail}
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:4px 0 8px 0;font-family:${MAIL_BRAND.fontSans};font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${MAIL_BRAND.muted};">
          Contraseña temporal
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:0 0 8px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" style="padding:14px 22px;background-color:${MAIL_BRAND.goldLight};border:1px solid ${MAIL_BRAND.gold};border-radius:12px;">
                <span style="font-family:${MAIL_BRAND.fontSans};font-size:20px;line-height:1.3;font-weight:700;letter-spacing:1px;color:${MAIL_BRAND.navy};">
                  ${safePassword}
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:12px 0 16px 0;font-family:${MAIL_BRAND.fontSans};font-size:13px;line-height:1.5;color:${MAIL_BRAND.muted};">
          Al iniciar sesión deberá cambiar esta contraseña. No la comparta.
        </td>
      </tr>
      <tr>
        <td style="padding:0 0 8px 0;font-family:${MAIL_BRAND.fontSans};font-size:13px;line-height:1.55;color:${MAIL_BRAND.muted};text-align:center;">
          Si el botón no funciona, abra este enlace:<br />
          <a href="${escapeAttr(input.loginUrl)}" style="color:${MAIL_BRAND.primary};word-break:break-all;">${safeUrl}</a>
        </td>
      </tr>
    </table>
  `;

  const html = renderInstitutionalMailLayout({
    preheader: `Credenciales temporales de acceso a ${MAIL_BRAND.productName}.`,
    title: 'Bienvenida y credenciales',
    bodyHtml,
    ctaLabel: 'Iniciar sesión',
    ctaUrl: input.loginUrl,
    includeLogo,
  });

  const text = [
    `Bienvenida — ${MAIL_BRAND.productName} ${MAIL_BRAND.institutionShort}`,
    '',
    `Hola ${input.fullName},`,
    '',
    'Se creó su cuenta institucional. Credenciales temporales:',
    `Correo: ${input.email}`,
    `Contraseña temporal: ${input.temporaryPassword}`,
    '',
    'Al iniciar sesión deberá cambiar esta contraseña. No la comparta.',
    '',
    `Inicie sesión en: ${input.loginUrl}`,
    '',
    MAIL_BRAND.institutionName,
    MAIL_BRAND.ministry,
  ].join('\n');

  return {
    subject: `Bienvenida y acceso — ${MAIL_BRAND.productName} ${MAIL_BRAND.institutionShort}`,
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
