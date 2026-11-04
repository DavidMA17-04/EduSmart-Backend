import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as fs from 'fs';
import { join } from 'path';
import { DataSource, EntityManager } from 'typeorm';
import { calendarDateInTimeZone } from '../../../common/utils/business-calendar-date.util';
import { Role } from '../../../common/enums/role.enum';
import { INSTITUTIONAL_ROLE_ADMIN } from '../../../common/constants/institutional-roles.constant';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { getSeverityRule } from '../constants/infraction-severity.constant';
import {
  CommunicationKind,
  DeliveryMedium,
  DisciplinaryCaseStatus,
  DisciplinaryTrack,
  EventVisibility,
  EvidenceContext,
} from '../constants/disciplinary.enums';
import { PhysicalFormalCommunicationDto, RecordPhysicalDeliveryDto } from '../dto/physical-delivery.dto';
import { DisciplinaryCaseEventEntity } from '../entities/disciplinary-case-event.entity';
import { DisciplinaryCaseEntity } from '../entities/disciplinary-case.entity';
import { DisciplinaryCommunicationEntity } from '../entities/disciplinary-communication.entity';
import { DisciplinaryEvidenceEntity } from '../entities/disciplinary-evidence.entity';
import { InfractionTypeEntity } from '../entities/infraction-type.entity';
import { institutionalToday } from '../utils/business-days';
import { DEFENSE_BUSINESS_DAYS } from './case-opening';
import { buildCommunicationPdf } from './communication-pdf';
import { DisciplinaryAccessService } from './disciplinary-access.service';
import { DisciplinaryActor } from './disciplinary-access.policy';
import { DisciplinaryCommunicationsService } from './disciplinary-communications.service';
import { DisciplinaryWorkflowService } from './disciplinary-workflow.service';
import { assertEvidenceFile, evidenceAbsolutePath } from './evidence-file';
import { buildFormalChargeBody } from './formal-charge';
import { canConductInvestigation } from './investigation';

export const PHYSICAL_DELIVERY_EVENT = 'PHYSICAL_DELIVERY';

const MEDIUM_NOTES: Record<DeliveryMedium, string> = {
  [DeliveryMedium.NOTEBOOK]: 'Entrega por cuaderno de comunicaciones',
  [DeliveryMedium.IN_PERSON]: 'Entrega presencial',
};

@Injectable()
export class DisciplinaryDeliveryService {
  private readonly storageRoot = join(process.cwd(), 'storage', 'disciplinary');

  constructor(
    private readonly dataSource: DataSource,
    private readonly workflow: DisciplinaryWorkflowService,
    private readonly communications: DisciplinaryCommunicationsService,
    private readonly access: DisciplinaryAccessService,
  ) {}

  async recordDelivery(
    actorUser: AuthenticatedUser,
    caseId: number,
    communicationId: number,
    dto: RecordPhysicalDeliveryDto,
    file?: Express.Multer.File,
  ) {
    const row = await this.requireCase(caseId);
    const actor = this.conductorFrom(actorUser);
    this.assertConductor(actor, row);
    const deliveredOn = this.assertDeliveredOn(dto.deliveredOn);
    const receivedByName = this.assertReceivedBy(dto.receivedByName);
    if (file) assertEvidenceFile(file);

    const evidenceId = await this.dataSource.transaction(async (manager) => {
      const communications = manager.getRepository(DisciplinaryCommunicationEntity);
      const communication = await communications.findOne({ where: { id: communicationId, caseId } });
      if (!communication) {
        throw new NotFoundException({ code: 'COMMUNICATION_NOT_FOUND', message: 'La comunicación no existe' });
      }
      if (communication.deliveryMedium) {
        throw new ConflictException({
          code: 'DELIVERY_ALREADY_RECORDED',
          message: 'Esta comunicación ya tiene una entrega física',
        });
      }
      const storedEvidenceId = file ? await this.storeReceipt(manager, caseId, file, actor.userId) : null;
      await communications.update(communication.id, {
        deliveryMedium: dto.medium,
        deliveredAt: deliveryInstant(deliveredOn),
        deliveredByUserId: actor.userId,
        receivedByName,
      });
      await this.writeDeliveryEvent(manager, {
        caseId,
        actorUserId: actor.userId,
        communicationId,
        medium: dto.medium,
        deliveredOn,
        receivedByName,
        evidenceId: storedEvidenceId,
      });
      if (!row.notifiedAt) {
        await manager.update(DisciplinaryCaseEntity, caseId, {
          notifiedAt: deliveryInstant(deliveredOn),
          stepStartedOn: deliveredOn,
        });
      }
      return storedEvidenceId;
    });

    return {
      caseId,
      communicationId,
      medium: dto.medium,
      deliveredOn,
      receivedByName,
      evidenceId,
    };
  }

  /** Crea la comunicación formal y la entrega cuando el estudiante no tiene encargado vinculado. */
  async deliverFormalCharge(
    actorUser: AuthenticatedUser,
    caseId: number,
    dto: PhysicalFormalCommunicationDto,
    file?: Express.Multer.File,
  ) {
    const row = await this.requireCase(caseId);
    const actor = this.conductorFrom(actorUser);
    this.assertConductor(actor, row);
    this.assertInvestigating(row);
    const proposedAction = dto.proposedAction.trim();
    if (proposedAction.length < 10) {
      throw new BadRequestException({
        code: 'PROPOSED_ACTION',
        message: 'La acción correctiva propuesta debe tener al menos 10 caracteres',
        field: 'proposedAction',
      });
    }
    const deliveredOn = this.assertDeliveredOn(dto.deliveredOn);
    const receivedByName = this.assertReceivedBy(dto.receivedByName);
    if (file) assertEvidenceFile(file);

    const pending = await this.dataSource.transaction(async (manager) => {
      const guardians = await this.communications.loadGuardians(manager, row.studentUserId);
      if (guardians.length > 0) {
        throw new BadRequestException({
          code: 'GUARDIANS_LINKED',
          message: 'Hay un encargado vinculado. Envíe la comunicación formal y registre la entrega sobre esa comunicación.',
        });
      }
      const infraction = await manager.getRepository(InfractionTypeEntity).findOne({
        where: { id: row.infractionTypeId },
      });
      const rule = getSeverityRule(row.severity);
      const issued = await this.communications.issue(manager, {
        caseId,
        kind: CommunicationKind.FORMAL_CHARGE,
        issuerUserId: actor.userId,
        studentUserId: row.studentUserId,
        subject: `Comunicación formal ${row.caseNumber}`,
        issuedAt: deliveryInstant(deliveredOn),
        body: buildFormalChargeBody({
          caseNumber: row.caseNumber,
          infractionName: infraction?.name ?? 'Falta',
          severityLabel: rule.label,
          deduction: rule.deduction,
          occurredOn: calendarDateInTimeZone(row.occurredAt),
          place: row.place,
          description: row.description,
          proposedAction,
        }),
      });
      const evidenceId = file ? await this.storeReceipt(manager, caseId, file, actor.userId) : null;
      await manager.getRepository(DisciplinaryCommunicationEntity).update(issued.communicationId, {
        deliveryMedium: dto.medium,
        deliveredAt: deliveryInstant(deliveredOn),
        deliveredByUserId: actor.userId,
        receivedByName,
      });
      await this.workflow.apply(manager, {
        caseId,
        track: row.track,
        from: row.status,
        to: DisciplinaryCaseStatus.COMMUNICATED,
        actorUserId: actor.userId,
        note: MEDIUM_NOTES[dto.medium],
      });
      await manager.update(DisciplinaryCaseEntity, caseId, {
        stepStartedOn: deliveredOn,
        stepBusinessDays: DEFENSE_BUSINESS_DAYS,
        notifiedAt: deliveryInstant(deliveredOn),
      });
      await this.writeDeliveryEvent(manager, {
        caseId,
        actorUserId: actor.userId,
        communicationId: issued.communicationId,
        medium: dto.medium,
        deliveredOn,
        receivedByName,
        evidenceId,
      });
      return { ...issued, evidenceId };
    });
    await this.communications.dispatch(pending.pending);
    return {
      id: caseId,
      status: DisciplinaryCaseStatus.COMMUNICATED,
      stepStartedOn: deliveredOn,
      stepBusinessDays: DEFENSE_BUSINESS_DAYS,
      communicationId: pending.communicationId,
      evidenceId: pending.evidenceId,
    };
  }

  async pdf(actorUser: AuthenticatedUser, caseId: number, communicationId: number): Promise<StreamableFile> {
    const row = await this.requireCase(caseId);
    const actor = await this.loadViewer(actorUser);
    this.access.assertCanView(actor, {
      studentUserId: row.studentUserId,
      reporterUserId: row.reporterUserId,
      responsibleUserId: row.responsibleUserId,
      groupId: row.groupId,
    });
    const communication = await this.dataSource.getRepository(DisciplinaryCommunicationEntity).findOne({
      where: { id: communicationId, caseId },
    });
    if (!communication) {
      throw new NotFoundException({ code: 'COMMUNICATION_NOT_FOUND', message: 'La comunicación no existe' });
    }
    const buffer = await buildCommunicationPdf({
      caseNumber: row.caseNumber,
      kind: communication.kind,
      body: communication.body,
      issuedOn: calendarDateInTimeZone(communication.issuedAt),
      deliveryMedium: communication.deliveryMedium,
      deliveredOn: communication.deliveredAt ? calendarDateInTimeZone(communication.deliveredAt) : null,
      receivedByName: communication.receivedByName,
    });
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `inline; filename="comunicacion-${row.caseNumber}.pdf"`,
    });
  }

  private async storeReceipt(
    manager: EntityManager,
    caseId: number,
    file: Express.Multer.File,
    authorUserId: number,
  ): Promise<number> {
    const ext = assertEvidenceFile(file);
    const storedName = `${Date.now()}-${randomBytes(4).toString('hex')}${ext}`;
    const storagePath = `${caseId}/${storedName}`;
    const directory = join(this.storageRoot, String(caseId));
    fs.mkdirSync(directory, { recursive: true });
    const absolute = evidenceAbsolutePath(this.storageRoot, storagePath);
    fs.writeFileSync(absolute, file.buffer);
    try {
      const evidences = manager.getRepository(DisciplinaryEvidenceEntity);
      const saved = await evidences.save(
        evidences.create({
          caseId,
          originalName: file.originalname.slice(0, 255),
          mimeType: file.mimetype,
          sizeBytes: file.size,
          storagePath,
          context: EvidenceContext.DELIVERY,
          authorUserId,
        }),
      );
      return saved.id;
    } catch (error) {
      if (fs.existsSync(absolute)) fs.unlinkSync(absolute);
      throw error;
    }
  }

  private async writeDeliveryEvent(
    manager: EntityManager,
    input: {
      caseId: number;
      actorUserId: number;
      communicationId: number;
      medium: DeliveryMedium;
      deliveredOn: string;
      receivedByName: string;
      evidenceId: number | null;
    },
  ): Promise<void> {
    const events = manager.getRepository(DisciplinaryCaseEventEntity);
    await events.save(
      events.create({
        caseId: input.caseId,
        type: PHYSICAL_DELIVERY_EVENT,
        actorUserId: input.actorUserId,
        payload: {
          note: MEDIUM_NOTES[input.medium],
          communicationId: input.communicationId,
          medium: input.medium,
          deliveredOn: input.deliveredOn,
          receivedByName: input.receivedByName,
          evidenceId: input.evidenceId,
        },
        visibility: EventVisibility.PUBLIC,
      }),
    );
  }

  private assertDeliveredOn(value: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))) {
      throw new BadRequestException({
        code: 'DELIVERY_DATE',
        message: 'La fecha de entrega no es válida',
        field: 'deliveredOn',
      });
    }
    if (value > institutionalToday()) {
      throw new BadRequestException({
        code: 'DELIVERY_DATE',
        message: 'La fecha de entrega no puede ser futura',
        field: 'deliveredOn',
      });
    }
    return value;
  }

  private assertReceivedBy(value: string): string {
    const name = value.trim();
    if (name.length < 2 || name.length > 150) {
      throw new BadRequestException({
        code: 'RECEIVED_BY',
        message: 'Indique quién recibió la comunicación',
        field: 'receivedByName',
      });
    }
    return name;
  }

  private assertInvestigating(row: DisciplinaryCaseEntity): void {
    if (row.track !== DisciplinaryTrack.DUE_PROCESS || row.status !== DisciplinaryCaseStatus.INVESTIGATING) {
      throw new BadRequestException({
        code: 'INVESTIGATION_STAGE',
        message: 'La comunicación formal solo se entrega durante la investigación',
      });
    }
  }

  private assertConductor(actor: DisciplinaryActor, row: DisciplinaryCaseEntity): void {
    if (!canConductInvestigation(actor, row.responsibleUserId)) {
      throw new ForbiddenException('No puede registrar la entrega de este expediente');
    }
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

  private async loadViewer(actor: AuthenticatedUser): Promise<DisciplinaryActor> {
    const [guides, links] = await Promise.all([
      this.dataSource.query(
        `SELECT id_groups AS groupId FROM teaching_assignments WHERE id_users = ? AND is_guide_teacher = 1`,
        [actor.id],
      ) as Promise<Array<{ groupId: number }>>,
      this.dataSource.query(
        `SELECT id_users_student AS studentUserId FROM guardian_student_links WHERE id_users_guardian = ?`,
        [actor.id],
      ) as Promise<Array<{ studentUserId: number }>>,
    ]);
    const base = this.conductorFrom(actor);
    return {
      ...base,
      guideGroupIds: guides.map((guide) => Number(guide.groupId)),
      linkedStudentIds: links.map((link) => Number(link.studentUserId)),
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

function deliveryInstant(isoDate: string): Date {
  return new Date(`${isoDate}T18:00:00.000Z`);
}
