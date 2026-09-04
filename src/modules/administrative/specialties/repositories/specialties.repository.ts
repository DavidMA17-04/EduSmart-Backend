import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SpecialtyKind } from '../../../../common/enums/specialty-kind.enum';
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

  async findAll(kind?: SpecialtyKind): Promise<SpecialtyEntity[]> {
    return this.repository.find({
      where: kind ? { kind } : undefined,
      order: { name: 'ASC' },
    });
  }

  async findById(id: number): Promise<SpecialtyEntity | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByName(name: string): Promise<SpecialtyEntity | null> {
    return this.repository.findOne({ where: { name } });
  }

  async countByKind(kind: SpecialtyKind): Promise<number> {
    return this.repository.count({ where: { kind } });
  }

  async deactivate(entity: SpecialtyEntity): Promise<SpecialtyEntity> {
    entity.status = SpecialtyStatus.INACTIVE;
    return this.repository.save(entity);
  }
}
