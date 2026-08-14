import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Section } from '../entities/section.entity';

@Injectable()
export class SectionsRepository {
  constructor(
    @InjectRepository(Section)
    private readonly repository: Repository<Section>,
  ) {}

  async findAll(): Promise<Section[]> {
    return this.repository.find();
  }
}
