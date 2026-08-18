import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateAcademicPeriodDto } from '../dto/create-academic-period.dto';
import { UpdateAcademicPeriodDto } from '../dto/update-academic-period.dto';
import { AcademicPeriod } from '../entities/academic-period.entity';
import { AcademicPeriodStatus } from '../enums/academic-period-status.enum';
import { AcademicPeriodsRepository } from '../repositories/academic-periods.repository';

@Injectable()
export class AcademicPeriodsService {
  constructor(private readonly repository: AcademicPeriodsRepository) {}

  findAll(): Promise<AcademicPeriod[]> {
    return this.repository.findAll();
  }

  create(dto: CreateAcademicPeriodDto): Promise<AcademicPeriod> {
    if (dto.startDate >= dto.endDate) {
      throw new BadRequestException(
        'La fecha de inicio debe ser anterior a la fecha de finalización',
      );
    }

    return this.repository.create({
      name: dto.name,
      startDate: dto.startDate,
      endDate: dto.endDate,
      status: AcademicPeriodStatus.PLANNED,
    });
  }

  async update(id: string, dto: UpdateAcademicPeriodDto): Promise<AcademicPeriod> {
    const period = await this.repository.findById(id);

    if (!period) {
      throw new NotFoundException('Período académico no encontrado');
    }

    const startDate = dto.startDate ?? period.startDate;
    const endDate = dto.endDate ?? period.endDate;

    if (startDate >= endDate) {
      throw new BadRequestException(
        'La fecha de inicio debe ser anterior a la fecha de finalización',
      );
    }

    if (dto.name !== undefined) {
      period.name = dto.name;
    }

    if (dto.startDate !== undefined) {
      period.startDate = dto.startDate;
    }

    if (dto.endDate !== undefined) {
      period.endDate = dto.endDate;
    }

    return this.repository.save(period);
  }
}
