import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubjectEntity } from '../entities/subject.entity';

@Injectable()
export class SubjectsRepository {
  constructor(
    @InjectRepository(SubjectEntity)
    private readonly repository: Repository<SubjectEntity>,
  ) {}

  create(data: Partial<SubjectEntity>): SubjectEntity {
    return this.repository.create(data);
  }

  save(entity: SubjectEntity): Promise<SubjectEntity> {
    return this.repository.save(entity);
  }

  findAll(): Promise<SubjectEntity[]> {
    return this.repository.find({ order: { name: 'ASC' } });
  }

  findById(id: number): Promise<SubjectEntity | null> {
    return this.repository.findOne({ where: { id } });
  }

  findByName(name: string): Promise<SubjectEntity | null> {
    return this.repository.findOne({ where: { name } });
  }
}
