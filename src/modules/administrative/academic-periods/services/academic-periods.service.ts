import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AcademicYearsRepository } from '../../academic-years/repositories/academic-years.repository';
import { CreateAcademicPeriodDto } from '../dto/create-academic-period.dto';
import { UpdateAcademicPeriodDto } from '../dto/update-academic-period.dto';
import { AcademicPeriod } from '../entities/academic-period.entity';
import { AcademicPeriodStatus } from '../enums/academic-period-status.enum';
import { AcademicPeriodsRepository } from '../repositories/academic-periods.repository';

@Injectable()
export class AcademicPeriodsService {
  constructor(
    private readonly repository: AcademicPeriodsRepository,
    private readonly academicYearsRepository: AcademicYearsRepository,
  ) {}

  findAll(): Promise<AcademicPeriod[]> {
    return this.repository.findAll();
  }

  /** Docentes: solo cursos del año lectivo activo (fallback: cursos ACTIVE). */
  async findVisibleForTeacher(): Promise<AcademicPeriod[]> {
    const activeYear = await this.academicYearsRepository.findActive();
    if (activeYear) {
      return this.repository.findByAcademicYearId(activeYear.id);
    }
    return this.repository.findActive();
  }

  async create(dto: CreateAcademicPeriodDto): Promise<AcademicPeriod> {
    if (dto.startDate >= dto.endDate) {
      throw new BadRequestException(
        'La fecha de inicio del curso lectivo debe ser anterior a la fecha de finalización',
      );
    }

    const academicYearId = dto.academicYearId ?? null;
    if (academicYearId != null) {
      const year = await this.academicYearsRepository.findById(academicYearId);
      if (!year) {
        throw new NotFoundException('Año lectivo no encontrado');
      }
    }

    await this.assertNoDateOverlap({
      academicYearId,
      startDate: dto.startDate,
      endDate: dto.endDate,
    });

    return this.repository.create({
      name: dto.name,
      startDate: dto.startDate,
      endDate: dto.endDate,
      academicYearId,
      status: AcademicPeriodStatus.PLANNED,
    });
  }

  async update(id: number, dto: UpdateAcademicPeriodDto): Promise<AcademicPeriod> {
    const period = await this.repository.findById(id);

    if (!period) {
      throw new NotFoundException('Curso lectivo no encontrado');
    }

    if (period.status === AcademicPeriodStatus.CLOSED) {
      throw new BadRequestException('No se puede editar un curso lectivo cerrado');
    }

    const startDate = dto.startDate ?? period.startDate;
    const endDate = dto.endDate ?? period.endDate;
    const academicYearId =
      dto.academicYearId !== undefined ? dto.academicYearId : period.academicYearId;

    if (startDate >= endDate) {
      throw new BadRequestException(
        'La fecha de inicio del curso lectivo debe ser anterior a la fecha de finalización',
      );
    }

    if (academicYearId != null) {
      const year = await this.academicYearsRepository.findById(academicYearId);
      if (!year) {
        throw new NotFoundException('Año lectivo no encontrado');
      }
    }

    await this.assertNoDateOverlap({
      academicYearId,
      startDate,
      endDate,
      excludeId: id,
    });

    if (dto.name !== undefined) period.name = dto.name;
    if (dto.startDate !== undefined) period.startDate = dto.startDate;
    if (dto.endDate !== undefined) period.endDate = dto.endDate;
    if (dto.academicYearId !== undefined) period.academicYearId = dto.academicYearId;

    return this.repository.save(period);
  }

  async close(id: number): Promise<AcademicPeriod> {
    const period = await this.repository.findById(id);

    if (!period) {
      throw new NotFoundException('Curso lectivo no encontrado');
    }

    period.status = AcademicPeriodStatus.CLOSED;

    return this.repository.save(period);
  }

  async activate(id: number): Promise<AcademicPeriod> {
    const period = await this.repository.findById(id);

    if (!period) {
      throw new NotFoundException('Curso lectivo no encontrado');
    }

    if (period.status === AcademicPeriodStatus.CLOSED) {
      throw new BadRequestException('No se puede activar un curso lectivo cerrado');
    }

    period.status = AcademicPeriodStatus.ACTIVE;

    return this.repository.save(period);
  }

  async reopen(id: number): Promise<AcademicPeriod> {
    const period = await this.repository.findById(id);

    if (!period) {
      throw new NotFoundException('Curso lectivo no encontrado');
    }

    if (period.status !== AcademicPeriodStatus.CLOSED) {
      throw new BadRequestException('Solo se puede reabrir un curso lectivo cerrado');
    }

    period.status = AcademicPeriodStatus.PLANNED;

    return this.repository.save(period);
  }

  private async assertNoDateOverlap(params: {
    academicYearId: number | null | undefined;
    startDate: string;
    endDate: string;
    excludeId?: number;
  }): Promise<void> {
    const conflicts = await this.repository.findOverlapping(params);
    if (conflicts.length > 0) {
      const names = conflicts.map((c) => `"${c.name}"`).join(', ');
      throw new BadRequestException(
        `Las fechas del curso lectivo se solapan con: ${names}. ` +
          'Dentro del mismo año lectivo no se permiten rangos traslapados.',
      );
    }
  }
}
