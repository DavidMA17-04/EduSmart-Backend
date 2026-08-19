import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SpecialtyStatus } from '../../../../common/enums/specialty-status.enum';
import { SpecialtyEntity } from '../entities/specialty.entity';

@Injectable()
export class SpecialtiesRepository {
  constructor(
    @InjectRepository(SpecialtyEntity)
    private readonly repository: Repository<SpecialtyEntity>,
  ) {}

  create(data: Partial<SpecialtyEntity>): SpecialtyEntity {
    return this.repository.create(data);
  }

  async save(entity: SpecialtyEntity): Promise<SpecialtyEntity> {
    return this.repository.save(entity);
  }

  async findAll(): Promise<SpecialtyEntity[]> {
    return this.repository.find({
      order: { code: 'ASC' },
    });
  }

  async findById(id: string): Promise<SpecialtyEntity | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByCode(code: string): Promise<SpecialtyEntity | null> {
    return this.repository.findOne({ where: { code } });
  }

  async findByName(name: string): Promise<SpecialtyEntity | null> {
    return this.repository.findOne({ where: { name } });
  }

  async deactivate(entity: SpecialtyEntity): Promise<SpecialtyEntity> {
    entity.status = SpecialtyStatus.INACTIVE;
    return this.repository.save(entity);
  }
}
