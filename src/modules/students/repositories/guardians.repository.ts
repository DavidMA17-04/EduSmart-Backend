import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Guardian } from '../entities/guardian.entity';

@Injectable()
export class GuardiansRepository {
  constructor(
    @InjectRepository(Guardian)
    private readonly repository: Repository<Guardian>,
  ) {}

  findAll(): Promise<Guardian[]> {
    return this.repository.find();
  }
}
