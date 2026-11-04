import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AcademicYear } from '../entities/academic-year.entity';
import { AcademicYearStatus } from '../enums/academic-year-status.enum';

@Injectable()
export class AcademicYearsRepository {
  constructor(
    @InjectRepository(AcademicYear)
    private readonly repository: Repository<AcademicYear>,
  ) {}

  findAll(): Promise<AcademicYear[]> {
    return this.repository.find({ order: { startDate: 'DESC' } });
  }

  findById(id: number): Promise<AcademicYear | null> {
    return this.repository.findOne({ where: { id } });
  }

  findActive(): Promise<AcademicYear | null> {
    return this.repository.findOne({ where: { status: AcademicYearStatus.ACTIVE } });
  }

  create(data: Partial<AcademicYear>): Promise<AcademicYear> {
    return this.repository.save(this.repository.create(data));
  }

  save(entity: AcademicYear): Promise<AcademicYear> {
    return this.repository.save(entity);
  }

  async clearActiveExcept(excludeId?: number): Promise<void> {
    const qb = this.repository
      .createQueryBuilder()
      .update(AcademicYear)
      .set({ status: AcademicYearStatus.PLANNED })
      .where('status = :status', { status: AcademicYearStatus.ACTIVE });

    if (excludeId != null) {
      qb.andWhere('id_academic_years != :excludeId', { excludeId });
    }

    await qb.execute();
  }
}
