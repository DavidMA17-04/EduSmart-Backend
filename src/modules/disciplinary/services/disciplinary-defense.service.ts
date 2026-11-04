import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as fs from 'fs';
import { join } from 'path';
import { DataSource, EntityManager } from 'typeorm';
import { Role } from '../../../common/enums/role.enum';
import { INSTITUTIONAL_ROLE_ADMIN } from '../../../common/constants/institutional-roles.constant';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import {
  DefenseChannel,
  DisciplinaryCaseStatus,
  DisciplinaryTrack,
  EventVisibility,
  EvidenceContext,
} from '../constants/disciplinary.enums';
import { FileDefenseDto } from '../dto/defense.dto';
import { DisciplinaryCaseEventEntity } from '../entities/disciplinary-case-event.entity';
import { DisciplinaryCaseEntity } from '../entities/disciplinary-case.entity';
import { DisciplinaryDefenseEntity } from '../entities/disciplinary-defense.entity';
import { DisciplinaryEvidenceEntity } from '../entities/disciplinary-evidence.entity';
import { addBusinessDays, institutionalToday } from '../utils/business-days';
import { RESOLUTION_BUSINESS_DAYS } from './deadline-reconcile';
import { DisciplinaryActor } from './disciplinary-access.policy';
import { DisciplinaryWorkflowService } from './disciplinary-workflow.service';
import { assertEvidenceFile, evidenceAbsolutePath } from './evidence-file';
import { canConductInvestigation } from './investigation';

export const DEFENSE_FILED_EVENT = 'DEFENSE_FILED';
export const PORTAL_DEFENSE_FILES = 3;

@Injectable()
export class DisciplinaryDefenseService {
  private readonly storageRoot = join(process.cwd(), 'storage', 'disciplinary');

  constructor(
    private readonly dataSource: DataSource,
    private readonly workflow: DisciplinaryWorkflowService,
  ) {}

  async fileFromPortal(
    actorUser: AuthenticatedUser,
    caseId: number,
    dto: FileDefenseDto,
    files: Express.Multer.File[] = [],
    today: string = institutionalToday(),
  ) {
    const row = await this.requireCase(caseId);
    const linked = await this.dataSource.query(
      `SELECT id_users_student AS studentUserId
       FROM guardian_student_links
       WHERE id_users_guardian = ? AND id_users_student = ?
       LIMIT 1`,
      [actorUser.id, row.studentUserId],
    );
    if (!linked.length) {
      throw new ForbiddenException('Solo un encargado vinculado puede presentar el descargo');
    }
    if (files.length > PORTAL_DEFENSE_FILES) {
      throw new BadRequestException({
        code: 'DEFENSE_FILES',
        message: 'El descargo admite como máximo 3 adjuntos',
      });
    }
    return this.file(row, actorUser.id, DefenseChannel.PORTAL, dto.body, files, today);
  }

  async fileWritten(
    actorUser: AuthenticatedUser,
    caseId: number,
    dto: FileDefenseDto,
    file?: Express.Multer.File,
    today: string = institutionalToday(),
  ) {
    const row = await this.requireCase(caseId);
    const actor = this.conductorFrom(actorUser);
    if (!canConductInvestigation(actor, row.responsibleUserId)) {
      throw new ForbiddenException('Solo el responsable puede registrar el descargo escrito');
    }
    if (!file) {
      throw new BadRequestException({
        code: 'DEFENSE_DOCUMENT',
        message: 'Adjunte el descargo entregado por escrito',
        field: 'file',
      });
    }
    return this.file(row, actor.userId, DefenseChannel.WRITTEN, dto.body, [file], today);
  }

  private async file(
    row: DisciplinaryCaseEntity,
    presenterUserId: number,
    channel: DefenseChannel,
    body: string,
    files: Express.Multer.File[],
    today: string,
  ) {
    const text = body.trim();
    if (text.length < 10) {
      throw new BadRequestException({
        code: 'DEFENSE_BODY',
        message: 'El descargo debe tener al menos 10 caracteres',
        field: 'body',
      });
    }
    for (const file of files) assertEvidenceFile(file);
    const stored: string[] = [];
    try {
      return await this.dataSource.transaction(async (manager) => {
        await this.assertOpen(manager, row, today);
        const defenses = manager.getRepository(DisciplinaryDefenseEntity);
        const saved = await defenses.save(
          defenses.create({
            caseId: row.id,
            body: text,
            channel,
            presentedByUserId: presenterUserId,
            presentedAt: new Date(),
          }),
        );
        const evidenceIds: number[] = [];
        for (const file of files) {
          evidenceIds.push(await this.storeFile(manager, row.id, file, presenterUserId, stored));
        }
        await this.workflow.apply(manager, {
          caseId: row.id,
          track: row.track,
          from: row.status,
          to: DisciplinaryCaseStatus.PENDING_RESOLUTION,
          actorUserId: presenterUserId,
          note: 'Descargo presentado',
        });
        await manager.update(DisciplinaryCaseEntity, row.id, {
          stepStartedOn: today,
          stepBusinessDays: RESOLUTION_BUSINESS_DAYS,
        });
        const events = manager.getRepository(DisciplinaryCaseEventEntity);
        await events.save(
          events.create({
            caseId: row.id,
            type: DEFENSE_FILED_EVENT,
            actorUserId: presenterUserId,
            payload: {
              note: 'Descargo presentado',
              defenseId: saved.id,
              channel,
              recipientUserId: row.responsibleUserId,
            },
            visibility: EventVisibility.PUBLIC,
          }),
        );
        return {
          id: saved.id,
          caseId: row.id,
          status: DisciplinaryCaseStatus.PENDING_RESOLUTION,
          channel,
          stepStartedOn: today,
          stepBusinessDays: RESOLUTION_BUSINESS_DAYS,
          evidenceIds,
        };
      });
    } catch (error) {
      for (const absolute of stored) {
        if (fs.existsSync(absolute)) fs.unlinkSync(absolute);
      }
      throw error;
    }
  }

  private async assertOpen(manager: EntityManager, row: DisciplinaryCaseEntity, today: string): Promise<void> {
    if (row.track !== DisciplinaryTrack.DUE_PROCESS || row.status !== DisciplinaryCaseStatus.COMMUNICATED) {
      throw new BadRequestException({
        code: 'DEFENSE_STAGE',
        message: 'El descargo solo se presenta cuando el expediente está comunicado',
      });
    }
    const existing = await manager.getRepository(DisciplinaryDefenseEntity).count({ where: { caseId: row.id } });
    if (existing > 0) {
      throw new BadRequestException({
        code: 'DEFENSE_ALREADY_FILED',
        message: 'Este expediente ya tiene un descargo',
      });
    }
    const holidays = (await manager.query('SELECT day FROM non_working_days')) as Array<{ day: string | Date }>;
    const nonWorkingDays = new Set(holidays.map((holiday) => String(holiday.day).slice(0, 10)));
    const started = String(row.stepStartedOn).slice(0, 10);
    if (row.stepBusinessDays <= 0) {
      throw new BadRequestException({
        code: 'DEFENSE_STAGE',
        message: 'El plazo de descargo no está abierto',
      });
    }
    const dueOn = addBusinessDays(started, row.stepBusinessDays, nonWorkingDays);
    if (today > dueOn) {
      throw new BadRequestException({
        code: 'DEFENSE_DEADLINE',
        message: 'El plazo de descargo venció',
      });
    }
  }

  private async storeFile(
    manager: EntityManager,
    caseId: number,
    file: Express.Multer.File,
    authorUserId: number,
    stored: string[],
  ): Promise<number> {
    const ext = assertEvidenceFile(file);
    const storedName = `${Date.now()}-${randomBytes(4).toString('hex')}${ext}`;
    const storagePath = `${caseId}/${storedName}`;
    const directory = join(this.storageRoot, String(caseId));
    fs.mkdirSync(directory, { recursive: true });
    const absolute = evidenceAbsolutePath(this.storageRoot, storagePath);
    fs.writeFileSync(absolute, file.buffer);
    stored.push(absolute);
    const evidences = manager.getRepository(DisciplinaryEvidenceEntity);
    const saved = await evidences.save(
      evidences.create({
        caseId,
        originalName: file.originalname.slice(0, 255),
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storagePath,
        context: EvidenceContext.DEFENSE,
        authorUserId,
      }),
    );
    return saved.id;
  }

  private conductorFrom(actor: AuthenticatedUser): DisciplinaryActor {
    const roleNames = (actor.roles ?? []).map(String);
    if (roleNames.includes(Role.ADMIN) && !roleNames.includes(INSTITUTIONAL_ROLE_ADMIN)) {
      roleNames.push(INSTITUTIONAL_ROLE_ADMIN);
    }
    return {
      userId: actor.id,
      permissions: actor.permissions ?? [],
      roleNames,
      guideGroupIds: [],
      linkedStudentIds: [],
    };
  }

  private async requireCase(caseId: number): Promise<DisciplinaryCaseEntity> {
    const row = await this.dataSource.getRepository(DisciplinaryCaseEntity).findOne({ where: { id: caseId } });
    if (!row) {
      throw new NotFoundException({ code: 'CASE_NOT_FOUND', message: 'El expediente no existe' });
    }
    return row;
  }
}
