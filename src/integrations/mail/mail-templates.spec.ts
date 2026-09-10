import { MAIL_BRAND } from './mail-brand.constants';
import { escapeHtml } from './mail-html.util';
import { tryLoadInstitutionLogoAttachment } from './optional-logo.attachment';
import { buildAccountVerificationMail } from './templates/account-verification.mail';
import { buildPasswordResetMail } from './templates/password-reset.mail';

describe('mail HTML utilities', () => {
  it('escapes special characters for HTML', () => {
    expect(escapeHtml(`a<b>&"c"'`)).toBe('a&lt;b&gt;&amp;&quot;c&quot;&#39;');
  });
});

describe('buildAccountVerificationMail', () => {
  const code = '482915';
  const email = 'usuario+test@ejemplo.com';
  const verifyUrl = 'http://localhost:5173/verify-account';

  it('includes OTP in html and text, URL, and institutional branding', () => {
    const mail = buildAccountVerificationMail({
      code,
      email,
      verifyUrl,
      validMinutes: 5,
      includeLogo: false,
    });

    expect(mail.subject).toContain('Verificación de cuenta');
    expect(mail.subject).toContain('EduSmart');
    expect(mail.subject).toContain('CTP Hojancha');

    expect(mail.text).toContain(code);
    expect(mail.text).toContain(email);
    expect(mail.text).toContain(verifyUrl);
    expect(mail.text).toContain('5 minutos');

    expect(mail.html).toContain(code);
    expect(mail.html).toContain(verifyUrl);
    expect(mail.html).toContain(MAIL_BRAND.navy);
    expect(mail.html).toContain(MAIL_BRAND.gold);
    expect(mail.html).toContain(MAIL_BRAND.productName);
    expect(mail.html).toContain('Código de verificación');
    expect(mail.html).toContain('Abrir verificación');
    expect(mail.html).toContain('<table');
    expect(mail.html).not.toContain(`cid:${MAIL_BRAND.logoCid}`);
  });

  it('escapes email special characters in HTML', () => {
    const mail = buildAccountVerificationMail({
      code,
      email: 'a<b>&"x"@ejemplo.com',
      verifyUrl,
      validMinutes: 5,
    });

    expect(mail.html).toContain('a&lt;b&gt;&amp;&quot;x&quot;@ejemplo.com');
    expect(mail.html).not.toContain('a<b>&"x"@ejemplo.com');
  });

  it('includes logo cid only when includeLogo is true', () => {
    const withLogo = buildAccountVerificationMail({
      code,
      email,
      verifyUrl,
      validMinutes: 5,
      includeLogo: true,
    });
    const withoutLogo = buildAccountVerificationMail({
      code,
      email,
      verifyUrl,
      validMinutes: 5,
      includeLogo: false,
    });

    expect(withLogo.html).toContain(`cid:${MAIL_BRAND.logoCid}`);
    expect(withoutLogo.html).not.toContain(`cid:${MAIL_BRAND.logoCid}`);
  });
});

describe('buildPasswordResetMail', () => {
  const email = 'docente@ctp.hojancha.edu';
  const resetUrl = 'http://localhost:5173/reset-password?token=abc123';

  it('keeps reset-specific subject, content, URL and validity', () => {
    const mail = buildPasswordResetMail({
      email,
      resetUrl,
      validMinutes: 60,
      includeLogo: false,
    });

    expect(mail.subject).toContain('Restablecer contraseña');
    expect(mail.subject).toContain('EduSmart');
    expect(mail.html).toContain(resetUrl);
    expect(mail.html).toContain('60 minutos');
    expect(mail.html).toContain(MAIL_BRAND.gold);
    expect(mail.html).toContain('Restablecer contraseña');
    expect(mail.text).toContain(resetUrl);
    expect(mail.text).toContain(email);
    expect(mail.html).not.toContain(`cid:${MAIL_BRAND.logoCid}`);
  });

  it('escapes special characters in email and does not break HTML', () => {
    const mail = buildPasswordResetMail({
      email: `evil<script>@ejemplo.com`,
      resetUrl: 'http://localhost:5173/reset-password?token=<tok>',
      validMinutes: 60,
    });

    expect(mail.html).toContain('evil&lt;script&gt;@ejemplo.com');
    expect(mail.html).toContain('token=&lt;tok&gt;');
    expect(mail.html).not.toContain('<script>');
  });
});

describe('tryLoadInstitutionLogoAttachment', () => {
  it('returns null or a valid attachment without throwing (fallback without logo)', () => {
    expect(() => tryLoadInstitutionLogoAttachment()).not.toThrow();
    const logo = tryLoadInstitutionLogoAttachment();
    if (logo) {
      expect(logo.cid).toBe(MAIL_BRAND.logoCid);
      expect(logo.filename).toBe(MAIL_BRAND.logoFilename);
      expect(Buffer.isBuffer(logo.content)).toBe(true);
      expect(logo.content.length).toBeGreaterThan(0);
    } else {
      expect(logo).toBeNull();
    }
  });
});
