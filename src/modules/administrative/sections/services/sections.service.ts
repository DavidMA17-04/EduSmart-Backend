import { Injectable, NotImplementedException } from '@nestjs/common';
import { SectionsRepository } from '../repositories/sections.repository';

@Injectable()
export class SectionsService {
  constructor(private readonly repository: SectionsRepository) {}

  findAll() {
    throw new NotImplementedException('Sections listado pendiente de implementar');
  }
}
