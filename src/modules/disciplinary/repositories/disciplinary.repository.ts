import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DisciplinaryAction } from '../entities/disciplinary-action.entity';

@Injectable()
export class DisciplinaryRepository {
  constructor(
    @InjectRepository(DisciplinaryAction)
    private readonly repository: Repository<DisciplinaryAction>,
  ) {}

  findAll(): Promise<DisciplinaryAction[]> {
    return this.repository.find();
  }
}
