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
      relations: { groups: true },
      order: { code: 'ASC' },
    });
  }

  async findById(id: string): Promise<SectionEntity | null> {
    return this.repository.findOne({
      where: { id },
      relations: { groups: true },
    });
  }

  async findByCode(code: string): Promise<SectionEntity | null> {
    return this.repository.findOne({ where: { code } });
  }

  async deactivate(entity: SectionEntity): Promise<SectionEntity> {
    entity.status = SectionStatus.INACTIVE;
    return this.repository.save(entity);
  }
}