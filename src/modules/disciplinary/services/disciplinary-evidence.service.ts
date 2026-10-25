import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createReadStream, existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { DisciplinaryCaseStatus, EvidenceContext } from '../constants/disciplinary.enums';
import { DisciplinaryCaseEntity } from '../entities/disciplinary-case.entity';
import { DisciplinaryEvidenceEntity } from '../entities/disciplinary-evidence.entity';
import { DisciplinaryAccessService } from './disciplinary-access.service';
import { DisciplinaryActor } from './disciplinary-access.policy';
import { assertEvidenceCount, assertEvidenceFile, evidenceAbsolutePath } from './evidence-file';

const UPLOAD_STATUSES = new Set<DisciplinaryCaseStatus>([
  DisciplinaryCaseStatus.REPORTED,
  DisciplinaryCaseStatus.NOTIFIED,
  DisciplinaryCaseStatus.INVESTIGATING,
]);

@Injectable()
export class DisciplinaryEvidenceService {
  private readonly storageRoot = join(process.cwd(), 'storage', 'disciplinary');

  constructor(
    private readonly dataSource: DataSource,
    private readonly access: DisciplinaryAccessService,
    @InjectRepository(DisciplinaryCaseEntity)
    private readonly cases: Repository<DisciplinaryCaseEntity>,
    @InjectRepository(DisciplinaryEvidenceEntity)
    private readonly evidences: Repository<DisciplinaryEvidenceEntity>,
  ) {}

  async upload(caseId: number, file: Express.Multer.File, actor: AuthenticatedUser) {
    const ext = assertEvidenceFile(file);
    const row = await this.requireCase(caseId);
    await this.assertCanView(actor, row);
    if (!UPLOAD_STATUSES.has(row.status)) {
      throw new BadRequestException({
        code: 'EVIDENCE_STAGE',
        message: 'Solo se adjuntan evidencias al registrar o durante la investigación',
      });
    }
    assertEvidenceCount(await this.evidences.count({ where: { caseId } }));

    const storedName = `${Date.now()}-${randomBytes(4).toString('hex')}${ext}`;
    const storagePath = `${caseId}/${storedName}`;
    const directory = join(this.storageRoot, String(caseId));
    mkdirSync(directory, { recursive: true });
    const absolute = evidenceAbsolutePath(this.storageRoot, storagePath);
    writeFileSync(absolute, file.buffer);
    try {
      const saved = await this.evidences.save(
        this.evidences.create({
          caseId,
          originalName: file.originalname.slice(0, 255),
          mimeType: file.mimetype,
          sizeBytes: file.size,
          storagePath,
          context:
            row.status === DisciplinaryCaseStatus.INVESTIGATING
              ? EvidenceContext.INVESTIGATION
              : EvidenceContext.REPORT,
          authorUserId: actor.id,
        }),
      );
      return {
        id: saved.id,
        caseId,
        originalName: saved.originalName,
        mimeType: saved.mimeType,
        sizeBytes: saved.sizeBytes,
        context: saved.context,
      };
    } catch (error) {
      if (existsSync(absolute)) unlinkSync(absolute);
      throw error;
    }
  }

  async download(caseId: number, evidenceId: number, actor: AuthenticatedUser): Promise<StreamableFile> {
    const row = await this.requireCase(caseId);
    await this.assertCanView(actor, row);
    const evidence = await this.evidences.findOne({ where: { id: evidenceId, caseId } });
    if (!evidence) {
      throw new NotFoundException({ code: 'EVIDENCE_NOT_FOUND', message: 'La evidencia no existe' });
    }
    const absolute = evidenceAbsolutePath(this.storageRoot, evidence.storagePath);
    if (!existsSync(absolute)) {
      throw new NotFoundException({ code: 'EVIDENCE_NOT_FOUND', message: 'La evidencia no existe' });
    }
    return new StreamableFile(createReadStream(absolute), {
      type: evidence.mimeType,
      disposition: `attachment; filename="${evidence.originalName.replace(/["\r\n]/g, '')}"`,
    });
  }

  private async requireCase(caseId: number): Promise<DisciplinaryCaseEntity> {
    const row = await this.cases.findOne({ where: { id: caseId } });
    if (!row) {
      throw new NotFoundException({ code: 'CASE_NOT_FOUND', message: 'El expediente no existe' });
    }
    return row;
  }

  private async assertCanView(actor: AuthenticatedUser, row: DisciplinaryCaseEntity): Promise<void> {
    const [guides, links] = await Promise.all([
      this.dataSource.query(
        `SELECT id_groups AS groupId FROM teaching_assignments WHERE id_users = ? AND is_guide_teacher = 1`,
        [actor.id],
      ),
      this.dataSource.query(
        `SELECT id_users_student AS studentUserId FROM guardian_student_links WHERE id_users_guardian = ?`,
        [actor.id],
      ),
    ]);
    const scope: DisciplinaryActor = {
      userId: actor.id,
      permissions: actor.permissions ?? [],
      roleNames: (actor.roles ?? []).map(String),
      guideGroupIds: guides.map((guide: { groupId: number }) => Number(guide.groupId)),
      linkedStudentIds: links.map((link: { studentUserId: number }) => Number(link.studentUserId)),
    };
    this.access.assertCanView(scope, {
      studentUserId: row.studentUserId,
      reporterUserId: row.reporterUserId,
      responsibleUserId: row.responsibleUserId,
      groupId: row.groupId,
    });
  }
}
