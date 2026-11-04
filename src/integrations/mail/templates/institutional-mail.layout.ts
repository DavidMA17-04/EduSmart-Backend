import { MAIL_BRAND } from '../mail-brand.constants';

export type InstitutionalMailContent = {
  preheader: string;
  title: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  includeLogo: boolean;
};

/**
 * Shared table-based shell for EduSmart / CTP Hojancha transactional mail.
 * Inline styles only — no flex/grid as critical layout.
 */
export function renderInstitutionalMailLayout(content: InstitutionalMailContent): string {
  const {
    navy,
    primary,
    gold,
    background,
    surface,
    border,
    muted,
    fontSerif,
    fontSans,
    productName,
    institutionShort,
    institutionName,
    ministry,
    logoCid,
  } = MAIL_BRAND;

  const logoBlock = content.includeLogo
    ? `<tr>
        <td align="center" style="padding:0 0 16px 0;">
          <img src="cid:${logoCid}" width="64" height="64" alt="${escapeAttr(institutionShort)}" style="display:block;border:0;outline:none;text-decoration:none;width:64px;height:64px;" />
        </td>
      </tr>`
    : '';

  const safeTitle = content.title;
  const safeCtaLabel = content.ctaLabel;
  const safeCtaUrl = escapeAttr(content.ctaUrl);
  const safePreheader = content.preheader;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background-color:${background};">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${safePreheader}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${background};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background-color:${surface};border:1px solid ${border};border-radius:12px;overflow:hidden;">
          <tr>
            <td style="height:4px;line-height:4px;font-size:0;background-color:${gold};">&nbsp;</td>
          </tr>
          <tr>
            <td align="center" style="padding:28px 28px 20px 28px;background-color:${navy};">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                ${logoBlock}
                <tr>
                  <td align="center" style="font-family:${fontSerif};font-size:26px;line-height:1.25;font-weight:700;color:#ffffff;">
                    ${productName}
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:8px;font-family:${fontSans};font-size:13px;line-height:1.4;color:${gold};letter-spacing:0.04em;">
                    ${institutionShort} · ${ministry}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px 28px;font-family:${fontSans};color:${MAIL_BRAND.text};">
              <h1 style="margin:0 0 16px 0;font-family:${fontSerif};font-size:22px;line-height:1.3;font-weight:700;color:${navy};text-align:center;">
                ${safeTitle}
              </h1>
              ${content.bodyHtml}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:8px 28px 28px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="${primary}" style="border-radius:8px;background-color:${primary};">
                    <a href="${safeCtaUrl}" style="display:inline-block;padding:12px 22px;font-family:${fontSans};font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">
                      ${safeCtaLabel}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 24px 28px;border-top:1px solid ${border};font-family:${fontSans};font-size:12px;line-height:1.5;color:${muted};text-align:center;">
              ${institutionName}<br />
              ${ministry}<br />
              Este mensaje fue enviado por ${productName}.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
