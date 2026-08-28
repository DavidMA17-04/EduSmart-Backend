import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AcademicPeriod } from '../entities/academic-period.entity';

@Injectable()
export class AcademicPeriodsRepository {
  constructor(
    @InjectRepository(AcademicPeriod)
    private readonly repository: Repository<AcademicPeriod>,
  ) {}

  async findAll(): Promise<AcademicPeriod[]> {
    return this.repository.find();
  }

  async findById(id: number): Promise<AcademicPeriod | null> {
    return this.repository.findOne({ where: { id } });
  }

  async create(data: Partial<AcademicPeriod>): Promise<AcademicPeriod> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async save(entity: AcademicPeriod): Promise<AcademicPeriod> {
    return this.repository.save(entity);
  }
}
