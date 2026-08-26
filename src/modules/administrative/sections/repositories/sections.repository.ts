import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SectionStatus } from '../../../../common/enums/section-status.enum';
import { SectionEntity } from '../entities/section.entity';

@Injectable()
export class SectionsRepository {
  constructor(
    @InjectRepository(SectionEntity)
    private readonly repository: Repository<SectionEntity>,
  ) {}

  create(data: Partial<SectionEntity>): SectionEntity {
    return this.repository.create(data);
  }

  async save(entity: SectionEntity): Promise<SectionEntity> {
    return this.repository.save(entity);
  }

  async findAll(): Promise<SectionEntity[]> {
    return this.repository.find({
      relations: { groups: true, specialty: true, academicPeriod: true },
      order: { gradeLevel: 'ASC', name: 'ASC' },
    });
  }

  async findById(id: number): Promise<SectionEntity | null> {
    return this.repository.findOne({
      where: { id },
      relations: { groups: true, specialty: true, academicPeriod: true },
    });
  }

  async deactivate(entity: SectionEntity): Promise<SectionEntity> {
    entity.status = SectionStatus.INACTIVE;
    return this.repository.save(entity);
  }
}
