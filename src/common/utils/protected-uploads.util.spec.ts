import { isJustificationUploadPath } from './protected-uploads.util';

describe('isJustificationUploadPath', () => {
  it.each([
    '/uploads/justifications/1-123-cert.pdf',
    '/uploads/justifications',
    '/UPLOADS/Justifications/1.pdf',
    '/uploads//justifications/1.pdf',
    '/uploads/covers/../justifications/1.pdf',
    '/uploads%2Fjustifications%2F1.pdf',
    '/uploads\\justifications\\1.pdf',
    '/uploads/%E0%A4%A',
  ])('blocks %s', (path) => {
    expect(isJustificationUploadPath(path)).toBe(true);
  });

  it.each(['/uploads/specialty-covers/a.png', '/api/v1/attendance/justifications/1/evidence/2'])(
    'allows %s',
    (path) => {
      expect(isJustificationUploadPath(path)).toBe(false);
    },
  );
});
