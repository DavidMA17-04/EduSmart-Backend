import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Specialty } from '../entities/specialty.entity';

@Injectable()
export class SpecialtiesRepository {
  constructor(
    @InjectRepository(Specialty)
    private readonly repository: Repository<Specialty>,
  ) {}

  async findAll(): Promise<Specialty[]> {
    return this.repository.find();
  }
}
