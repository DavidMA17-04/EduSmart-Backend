import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { INSTITUTIONAL_ROLE_ADMIN } from '../../../common/constants/institutional-roles.constant';
import { Role } from '../../../common/enums/role.enum';
import { AuditLog } from '../../administrative/users/entities/audit-log.entity';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { getSeverityRule, InfractionSeverity } from '../constants/infraction-severity.constant';
import {
  CommunicationKind,
  DisciplinaryCaseStatus,
  EventVisibility,
} from '../constants/disciplinary.enums';
import { OrderPrecautionaryDto } from '../dto/precautionary.dto';
import { DisciplinaryCaseEventEntity } from '../entities/disciplinary-case-event.entity';
import { DisciplinaryCaseEntity } from '../entities/disciplinary-case.entity';
import { DisciplinaryPrecautionaryMeasureEntity } from '../entities/disciplinary-precautionary-measure.entity';
import { DisciplinaryCommunicationsService } from './disciplinary-communications.service';
import { FINAL_CASE_STATUSES } from './disciplinary-workflow';
import { DISCIPLINARY_CASE_AUDIT_ENTITY } from './disciplinary-workflow.service';

export const PRECAUTIONARY_MAX_NATURAL_DAYS = 10;
export const PRECAUTIONARY_EVENT = 'PRECAUTIONARY_ORDERED';

const ELIGIBLE_SEVERITIES = new Set<InfractionSeverity>([
  InfractionSeverity.SERIOUS,
  InfractionSeverity.VERY_SERIOUS,
  InfractionSeverity.EXTREMELY_SERIOUS,
]);

@Injectable()
export class DisciplinaryPrecautionaryService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly communications: DisciplinaryCommunicationsService,
  ) {}

  async order(actorUser: AuthenticatedUser, caseId: number, dto: OrderPrecautionaryDto) {
    this.assertDirector(actorUser);
    const row = await this.requireCase(caseId);
    if (FINAL_CASE_STATUSES.has(row.status) || row.status === DisciplinaryCaseStatus.NOTIFIED) {
      throw new BadRequestException({
        code: 'PRECAUTIONARY_STAGE',
        message: 'El retiro precautorio solo aplica a un expediente abierto de debido proceso',
      });
    }
    if (!ELIGIBLE_SEVERITIES.has(row.severity)) {
      throw new BadRequestException({
        code: 'PRECAUTIONARY_SEVERITY',
        message: 'El retiro precautorio solo aplica a faltas graves o mayores',
      });
    }
    const startsOn = this.assertDate(dto.startsOn, 'startsOn');
    const endsOn = this.assertDate(dto.endsOn, 'endsOn');
    const days = inclusiveNaturalDays(startsOn, endsOn);
    if (days < 1) {
      throw new BadRequestException({
        code: 'PRECAUTIONARY_DATES',
        message: 'La fecha de fin no puede ser anterior al inicio',
        field: 'endsOn',
      });
    }
    if (days > PRECAUTIONARY_MAX_NATURAL_DAYS) {
      throw new BadRequestException({
        code: 'PRECAUTIONARY_DURATION',
        message: 'El retiro precautorio no puede superar 10 días naturales',
        field: 'endsOn',
      });
    }
    const reason = dto.reason.trim();
    if (reason.length < 10) {
      throw new BadRequestException({
        code: 'PRECAUTIONARY_REASON',
        message: 'El motivo debe tener al menos 10 caracteres',
        field: 'reason',
      });
    }
    if (typeof dto.paniCoordination !== 'boolean') {
      throw new BadRequestException({
        code: 'PRECAUTIONARY_PANI',
        message: 'Indique si hubo coordinación con el PANI',
        field: 'paniCoordination',
      });
    }
    const severityBefore = row.severity;
    const statusBefore = row.status;
    const pending = await this.dataSource.transaction(async (manager) => {
      const measures = manager.getRepository(DisciplinaryPrecautionaryMeasureEntity);
      const saved = await measures.save(
        measures.create({
          caseId,
          startsOn,
          endsOn,
          reason,
          paniCoordination: dto.paniCoordination,
          orderedByUserId: actorUser.id,
        }),
      );
      const events = manager.getRepository(DisciplinaryCaseEventEntity);
      await events.save(
        events.create({
          caseId,
          type: PRECAUTIONARY_EVENT,
          actorUserId: actorUser.id,
          payload: {
            note: 'Retiro precautorio ordenado. No afecta la nota de conducta.',
            measureId: saved.id,
            startsOn,
            endsOn,
            paniCoordination: dto.paniCoordination,
          },
          visibility: EventVisibility.PUBLIC,
        }),
      );
      const audit = manager.getRepository(AuditLog);
      await audit.save(
        audit.create({
          actorId: actorUser.id,
          action: PRECAUTIONARY_EVENT,
          entity: DISCIPLINARY_CASE_AUDIT_ENTITY,
          entityId: String(caseId),
          before: { status: statusBefore, severity: severityBefore },
          after: { status: statusBefore, severity: severityBefore, startsOn, endsOn, paniCoordination: dto.paniCoordination },
        }),
      );
      const rule = getSeverityRule(row.severity);
      const issued = await this.communications.issue(manager, {
        caseId,
        kind: CommunicationKind.PRECAUTIONARY,
        issuerUserId: actorUser.id,
        studentUserId: row.studentUserId,
        subject: `Retiro precautorio ${row.caseNumber}`,
        body: [
          `Retiro precautorio del expediente ${row.caseNumber}.`,
          `Del ${startsOn} al ${endsOn} (${days} días naturales).`,
          `Motivo: ${reason}`,
          dto.paniCoordination ? 'Se coordinó con el PANI.' : 'No se marcó coordinación con el PANI.',
          `Esta medida no es una sanción y no afecta la nota de conducta. La gravedad sigue en ${rule.label} y el rebajo propuesto, de ${rule.deduction} puntos, solo se aplica si el acto queda firme.`,
        ].join('\n'),
      });
      return { id: saved.id, issued };
    });
    await this.communications.dispatch(pending.issued.pending);
    return {
      id: pending.id,
      caseId,
      startsOn,
      endsOn,
      days,
      paniCoordination: dto.paniCoordination,
      status: row.status,
      severity: row.severity,
      deduction: getSeverityRule(row.severity).deduction,
      communicationId: pending.issued.communicationId,
    };
  }

  private assertDirector(actor: AuthenticatedUser): void {
    const roles = (actor.roles ?? []).map(String);
    const isAdmin = roles.includes(Role.ADMIN) || roles.includes(INSTITUTIONAL_ROLE_ADMIN);
    if (isAdmin || (actor.permissions ?? []).includes(PERMISSIONS.DISCIPLINARY_PRECAUTIONARY)) return;
    throw new ForbiddenException('Solo Dirección puede ordenar el retiro precautorio');
  }

  private assertDate(value: string, field: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))) {
      throw new BadRequestException({
        code: 'PRECAUTIONARY_DATES',
        message: 'La fecha del retiro no es válida',
        field,
      });
    }
    return value;
  }

  private async requireCase(caseId: number): Promise<DisciplinaryCaseEntity> {
    const row = await this.dataSource.getRepository(DisciplinaryCaseEntity).findOne({ where: { id: caseId } });
    if (!row) {
      throw new NotFoundException({ code: 'CASE_NOT_FOUND', message: 'El expediente no existe' });
    }
    return row;
  }
}

export function inclusiveNaturalDays(startsOn: string, endsOn: string): number {
  const start = Date.parse(`${startsOn}T00:00:00.000Z`);
  const end = Date.parse(`${endsOn}T00:00:00.000Z`);
  return Math.round((end - start) / 86_400_000) + 1;
}
