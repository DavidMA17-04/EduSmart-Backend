import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbsenceJustification } from '../entities/absence-justification.entity';

@Injectable()
export class JustificationsRepository {
  constructor(
    @InjectRepository(AbsenceJustification)
    private readonly repository: Repository<AbsenceJustification>,
  ) {}

  findAll(): Promise<AbsenceJustification[]> {
    return this.repository.find();
  }
}
