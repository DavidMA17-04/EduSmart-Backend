import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AcademicPeriod } from '../entities/academic-period.entity';
import { AcademicPeriodStatus } from '../enums/academic-period-status.enum';
import { datesOverlap } from '../utils/date-overlap.util';

@Injectable()
export class AcademicPeriodsRepository {
  constructor(
    @InjectRepository(AcademicPeriod)
    private readonly repository: Repository<AcademicPeriod>,
  ) {}

  async findAll(): Promise<AcademicPeriod[]> {
    return this.repository.find({ order: { startDate: 'DESC' } });
  }

  async findByAcademicYearId(academicYearId: number): Promise<AcademicPeriod[]> {
    return this.repository.find({
      where: { academicYearId },
      order: { startDate: 'ASC' },
    });
  }

  async findActive(): Promise<AcademicPeriod[]> {
    return this.repository.find({
      where: { status: AcademicPeriodStatus.ACTIVE },
      order: { startDate: 'ASC' },
    });
  }

  async findById(id: number): Promise<AcademicPeriod | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findOverlapping(params: {
    academicYearId: number | null | undefined;
    startDate: string;
    endDate: string;
    excludeId?: number;
  }): Promise<AcademicPeriod[]> {
    const qb = this.repository.createQueryBuilder('p');

    if (params.academicYearId == null) {
      qb.where('p.id_academic_years IS NULL');
    } else {
      qb.where('p.id_academic_years = :yearId', { yearId: params.academicYearId });
    }

    if (params.excludeId != null) {
      qb.andWhere('p.id_academic_periods != :excludeId', { excludeId: params.excludeId });
    }

    const candidates = await qb.getMany();
    return candidates.filter((period) =>
      datesOverlap(params.startDate, params.endDate, period.startDate, period.endDate),
    );
  }

  async create(data: Partial<AcademicPeriod>): Promise<AcademicPeriod> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async save(entity: AcademicPeriod): Promise<AcademicPeriod> {
    return this.repository.save(entity);
  }
}
