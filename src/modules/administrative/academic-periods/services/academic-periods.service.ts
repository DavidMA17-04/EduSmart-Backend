import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateAcademicPeriodDto } from '../dto/create-academic-period.dto';
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
}
