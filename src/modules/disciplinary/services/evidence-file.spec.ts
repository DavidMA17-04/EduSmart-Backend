import { BadRequestException, NotFoundException } from '@nestjs/common';
import { join } from 'path';
import { readFileSync } from 'fs';
import { assertEvidenceCount, assertEvidenceFile, evidenceAbsolutePath, EVIDENCE_MAX_BYTES } from './evidence-file';

describe('evidencias del expediente', () => {
  it('rechaza un docx y acepta un PDF', () => {
    expect(() =>
      assertEvidenceFile({ originalname: 'acta.docx', mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 100 }),
    ).toThrow(BadRequestException);
    expect(assertEvidenceFile({ originalname: 'acta.pdf', mimetype: 'application/pdf', size: 100 })).toBe('.pdf');
  });

  it('rechaza un archivo de más de 10 MB y el sexto adjunto', () => {
    expect(() =>
      assertEvidenceFile({ originalname: 'foto.jpg', mimetype: 'image/jpeg', size: EVIDENCE_MAX_BYTES + 1 }),
    ).toThrow(BadRequestException);
    expect(() => assertEvidenceCount(5)).toThrow(BadRequestException);
    expect(() => assertEvidenceCount(4)).not.toThrow();
  });

  it('no resuelve una ruta fuera de storage/disciplinary', () => {
    const root = join(process.cwd(), 'storage', 'disciplinary');
    expect(evidenceAbsolutePath(root, '12/acta.pdf')).toContain(join('12', 'acta.pdf'));
    expect(() => evidenceAbsolutePath(root, '../uploads/secreto.pdf')).toThrow(NotFoundException);
  });

  it('el servidor solo publica /uploads, no storage/disciplinary', () => {
    const main = readFileSync(join(__dirname, '../../../main.ts'), 'utf8');
    const gitignore = readFileSync(join(__dirname, '../../../../.gitignore'), 'utf8');
    expect(main).toContain("prefix: '/uploads/'");
    expect(main).not.toContain('storage/disciplinary');
    expect(gitignore).toContain('/storage');
  });
});
