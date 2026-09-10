import { MAIL_BRAND } from '../mail-brand.constants';
import { escapeHtml } from '../mail-html.util';
import { renderInstitutionalMailLayout } from './institutional-mail.layout';

export type AccountVerificationMailInput = {
  code: string;
  email: string;
  verifyUrl: string;
  /** Minutes of validity (display only; policy stays in ACCOUNT_VERIFICATION). */
  validMinutes: number;
  includeLogo?: boolean;
};

export type BuiltMail = {
  subject: string;
  text: string;
  html: string;
};

export function buildAccountVerificationMail(input: AccountVerificationMailInput): BuiltMail {
  const includeLogo = Boolean(input.includeLogo);
  const safeEmail = escapeHtml(input.email);
  const safeCode = escapeHtml(input.code);
  const safeUrl = escapeHtml(input.verifyUrl);
  const minutes = input.validMinutes;

  const bodyHtml = `
    <p style="margin:0 0 12px 0;font-size:15px;line-height:1.55;text-align:center;color:${MAIL_BRAND.text};">
      Use el siguiente código para verificar su cuenta en
      <strong style="color:${MAIL_BRAND.navy};">${MAIL_BRAND.productName}</strong>.
    </p>
    <p style="margin:0 0 20px 0;font-size:13px;line-height:1.5;text-align:center;color:${MAIL_BRAND.muted};">
      Enviado a: <strong style="color:${MAIL_BRAND.navy};">${safeEmail}</strong>
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td align="center" style="padding:4px 0 8px 0;font-family:${MAIL_BRAND.fontSans};font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${MAIL_BRAND.muted};">
          Código de verificación
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:0 0 8px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" style="padding:18px 28px;background-color:${MAIL_BRAND.goldLight};border:1px solid ${MAIL_BRAND.gold};border-radius:12px;">
                <span style="font-family:${MAIL_BRAND.fontSans};font-size:36px;line-height:1.2;font-weight:700;letter-spacing:10px;color:${MAIL_BRAND.navy};">
                  ${safeCode}
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:8px 0 16px 0;font-family:${MAIL_BRAND.fontSans};font-size:13px;line-height:1.5;color:${MAIL_BRAND.muted};">
          Válido por ${minutes} minutos. Es de un solo uso.
        </td>
      </tr>
      <tr>
        <td style="padding:0 0 8px 0;font-family:${MAIL_BRAND.fontSans};font-size:13px;line-height:1.55;color:${MAIL_BRAND.muted};text-align:center;">
          Si el botón no funciona, abra este enlace:<br />
          <a href="${escapeAttr(input.verifyUrl)}" style="color:${MAIL_BRAND.primary};word-break:break-all;">${safeUrl}</a>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 0 0 0;font-family:${MAIL_BRAND.fontSans};font-size:12px;line-height:1.5;color:${MAIL_BRAND.muted};text-align:center;">
          Si usted no solicitó esta cuenta, ignore este mensaje.
        </td>
      </tr>
    </table>
  `;

  const html = renderInstitutionalMailLayout({
    preheader: `Su código de verificación EduSmart vence en ${minutes} minutos.`,
    title: 'Verifica tu cuenta',
    bodyHtml,
    ctaLabel: 'Abrir verificación',
    ctaUrl: input.verifyUrl,
    includeLogo,
  });

  const text = [
    `Verificación de cuenta ${MAIL_BRAND.productName} — ${MAIL_BRAND.institutionShort}`,
    '',
    `Enviado a: ${input.email}`,
    '',
    `Su código de verificación es: ${input.code}`,
    `Válido por ${minutes} minutos. Es de un solo uso.`,
    '',
    `Ingrese el código en: ${input.verifyUrl}`,
    '',
    'Si usted no solicitó esta cuenta, ignore este mensaje.',
    '',
    `${MAIL_BRAND.institutionName}`,
    MAIL_BRAND.ministry,
  ].join('\n');

  return {
    subject: `Verificación de cuenta — ${MAIL_BRAND.productName} ${MAIL_BRAND.institutionShort}`,
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
