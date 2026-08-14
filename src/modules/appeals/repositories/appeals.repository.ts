import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appeal } from '../entities/appeal.entity';

@Injectable()
export class AppealsRepository {
  constructor(
    @InjectRepository(Appeal)
    private readonly repository: Repository<Appeal>,
  ) {}

  findAll(): Promise<Appeal[]> {
    return this.repository.find();
  }
}
