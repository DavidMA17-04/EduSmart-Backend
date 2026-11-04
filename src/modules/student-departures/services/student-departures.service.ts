import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { RequestClientMeta } from '../../auth/utils/request-client-meta';
import { CreateDepartureDto } from '../dto/create-departure.dto';
import { DepartureHistoryFilterDto } from '../dto/departure-history-filter.dto';
import {
  ScheduledDeparturePermit,
  ScheduledPermitStatus,
} from '../entities/scheduled-departure-permit.entity';
import {
  DepartureStatus,
  DepartureType,
  StudentDeparture,
} from '../entities/student-departure.entity';
import { PaginatedDepartures, TodayKpis } from '../interfaces/departures.interface';
import { DeparturesRepository } from '../repositories/departures.repository';
import { costaRicaTodayBounds } from '../utils/costa-rica-time';
import {
  DepartureValidationService,
  GUARDIAN_MISMATCH_MESSAGE,
} from './departure-validation.service';

@Injectable()
export class StudentDeparturesService {
  constructor(
    private readonly repository: DeparturesRepository,
    private readonly validation: DepartureValidationService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * Registra la salida. El servidor vuelve a validar al encargado: una
   * autorización que no coincide se guarda como intento denegado y se rechaza.
   */
  async register(
    dto: CreateDepartureDto,
    actor: AuthenticatedUser,
    meta: RequestClientMeta,
  ): Promise<{ id: string; status: DepartureStatus; scheduledPermitCompleted: boolean }> {
    const decision = dto.decision ?? DepartureStatus.AUTHORIZED;
    const check = await this.validation.checkGuardian(
      dto.studentIdentifier,
      dto.guardianIdentifier,
    );
    const today = costaRicaTodayBounds();

    // Permiso programado: debe ser del estudiante, de hoy y estar pendiente.
    let permit: ScheduledDeparturePermit | null = null;
    if (dto.scheduledPermitId) {
      permit = await this.dataSource.getRepository(ScheduledDeparturePermit).findOne({
        where: { id: dto.scheduledPermitId },
      });
      if (!permit || permit.studentId !== check.student.id) {
        throw new NotFoundException('El permiso programado no corresponde a este estudiante.');
      }
      if (permit.status !== ScheduledPermitStatus.PENDING || permit.permitDate !== today.date) {
        throw new BadRequestException('El permiso programado no está pendiente para hoy.');
      }
    }

    const departureType =
      dto.departureType ?? (permit ? DepartureType.EARLY : DepartureType.REGULAR);

    if (decision === DepartureStatus.REJECTED) {
      const id = await this.validation.recordRejection(check, actor, meta, {
        reason: dto.justificationReason ?? 'Salida rechazada por el guarda en caseta',
        kind: 'MANUAL',
        departureType,
        scheduledPermitId: permit?.id ?? null,
      });
      return { id, status: DepartureStatus.REJECTED, scheduledPermitCompleted: false };
    }

    if (!check.match) {
      await this.validation.recordRejection(check, actor, meta, {
        reason: GUARDIAN_MISMATCH_MESSAGE,
        departureType,
        scheduledPermitId: permit?.id ?? null,
      });
      throw new UnprocessableEntityException(GUARDIAN_MISMATCH_MESSAGE);
    }

    if (departureType === DepartureType.EMERGENCY && !dto.justificationReason) {
      throw new BadRequestException('Las salidas de emergencia requieren un motivo.');
    }

    const match = check.match;
    const result = await this.dataSource.transaction(async (manager) => {
      const departureRepo = manager.getRepository(StudentDeparture);
      const saved = await departureRepo.save(
        departureRepo.create({
          studentId: check.student.id,
          guardianId: match.id,
          guardianIdentifier: check.guardianNationalId,
          relationship: match.relationship,
          securityGuardId: actor.id,
          scheduledPermitId: permit?.id ?? null,
          departureTime: new Date(),
          status: DepartureStatus.AUTHORIZED,
          departureType,
          justificationReason: dto.justificationReason ?? (permit ? permit.reason : null),
        }),
      );

      let scheduledPermitCompleted = false;
      if (permit) {
        // Condición en el WHERE: evita completar dos veces el mismo permiso en paralelo.
        const update = await manager
          .getRepository(ScheduledDeparturePermit)
          .createQueryBuilder()
          .update()
          .set({ status: ScheduledPermitStatus.COMPLETED, completedAt: new Date() })
          .where('id = :id AND status = :pending', {
            id: permit.id,
            pending: ScheduledPermitStatus.PENDING,
          })
          .execute();
        if (!update.affected) {
          throw new BadRequestException('El permiso programado ya fue utilizado.');
        }
        scheduledPermitCompleted = true;
      }
      return { id: saved.id, scheduledPermitCompleted };
    });

    return {
      id: result.id,
      status: DepartureStatus.AUTHORIZED,
      scheduledPermitCompleted: result.scheduledPermitCompleted,
    };
  }

  async todayKpis(): Promise<TodayKpis> {
    const today = costaRicaTodayBounds();
    await this.repository.expireStalePermits(today.date);
    const counts = await this.repository.countTodayKpis(today.start, today.end, today.date);
    return { date: today.date, ...counts, generatedAt: new Date() };
  }

  groups() {
    return this.repository.findActiveGroups();
  }

  async history(filter: DepartureHistoryFilterDto): Promise<PaginatedDepartures> {
    if (filter.startDate && filter.endDate && filter.startDate > filter.endDate) {
      throw new BadRequestException('La fecha inicial no puede ser posterior a la final.');
    }
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const { items, total } = await this.repository.findHistory(filter, {
      limit,
      offset: (page - 1) * limit,
    });
    return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }
}
