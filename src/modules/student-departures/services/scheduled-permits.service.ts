import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { CreateScheduledPermitDto, ScheduledPermitFilterDto } from '../dto/scheduled-permit.dto';
import {
  ScheduledDeparturePermit,
  ScheduledPermitStatus,
} from '../entities/scheduled-departure-permit.entity';
import { ScheduledPermitView } from '../interfaces/departures.interface';
import { DeparturesRepository } from '../repositories/departures.repository';
import { costaRicaDateString } from '../utils/costa-rica-time';

@Injectable()
export class ScheduledPermitsService {
  constructor(
    private readonly repository: DeparturesRepository,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async today(): Promise<ScheduledPermitView[]> {
    const today = costaRicaDateString();
    await this.repository.expireStalePermits(today);
    return this.repository.findPermits({ date: today, status: ScheduledPermitStatus.PENDING });
  }

  async list(filter: ScheduledPermitFilterDto): Promise<ScheduledPermitView[]> {
    await this.repository.expireStalePermits(costaRicaDateString());
    return this.repository.findPermits({
      date: filter.date ?? costaRicaDateString(),
      status: filter.status,
    });
  }

  async create(
    dto: CreateScheduledPermitDto,
    actor: AuthenticatedUser,
  ): Promise<ScheduledPermitView> {
    if (dto.permitDate < costaRicaDateString()) {
      throw new BadRequestException('No se pueden programar permisos en fechas pasadas.');
    }
    const student = await this.repository.findActiveStudent(dto.studentIdentifier);
    if (!student) {
      throw new NotFoundException('No se encontró un estudiante activo con esa identificación.');
    }
    const repo = this.dataSource.getRepository(ScheduledDeparturePermit);
    const saved = await repo.save(
      repo.create({
        studentId: student.id,
        authorizedById: actor.id,
        permitDate: dto.permitDate,
        departureTime: `${dto.departureTime}:00`,
        reason: dto.reason,
        status: ScheduledPermitStatus.PENDING,
        completedAt: null,
      }),
    );
    const [view] = await this.repository.findPermits({ id: saved.id });
    return view;
  }

  async complete(id: string): Promise<ScheduledPermitView> {
    const result = await this.dataSource
      .getRepository(ScheduledDeparturePermit)
      .createQueryBuilder()
      .update()
      .set({ status: ScheduledPermitStatus.COMPLETED, completedAt: new Date() })
      .where('id = :id AND status = :pending', { id, pending: ScheduledPermitStatus.PENDING })
      .execute();
    const [view] = await this.repository.findPermits({ id });
    if (!view) {
      throw new NotFoundException('Permiso programado no encontrado.');
    }
    if (!result.affected) {
      throw new BadRequestException('El permiso ya no está pendiente.');
    }
    return view;
  }
}
