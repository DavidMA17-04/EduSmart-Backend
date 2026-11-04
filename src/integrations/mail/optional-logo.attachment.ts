import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { MAIL_BRAND } from './mail-brand.constants';

export type MailCidAttachment = {
  filename: string;
  content: Buffer;
  cid: string;
  contentType: string;
};

/**
 * Optionally loads the institutional logo for CID embedding.
 * Any missing file or read failure returns null — never throws.
 */
export function tryLoadInstitutionLogoAttachment(): MailCidAttachment | null {
  const candidates = [
    join(
      __dirname,
      '..',
      '..',
      'modules',
      'administrative',
      'reports',
      'assets',
      MAIL_BRAND.logoFilename,
    ),
    join(
      process.cwd(),
      'src',
      'modules',
      'administrative',
      'reports',
      'assets',
      MAIL_BRAND.logoFilename,
    ),
    join(
      process.cwd(),
      'dist',
      'modules',
      'administrative',
      'reports',
      'assets',
      MAIL_BRAND.logoFilename,
    ),
  ];

  for (const candidate of candidates) {
    try {
      if (!existsSync(candidate)) {
        continue;
      }
      const content = readFileSync(candidate);
      if (!content.length) {
        continue;
      }
      return {
        filename: MAIL_BRAND.logoFilename,
        content,
        cid: MAIL_BRAND.logoCid,
        contentType: 'image/png',
      };
    } catch {
      continue;
    }
  }

  return null;
}
