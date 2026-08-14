import { Injectable, NotImplementedException } from '@nestjs/common';
import { SpecialtiesRepository } from '../repositories/specialties.repository';

@Injectable()
export class SpecialtiesService {
  constructor(private readonly repository: SpecialtiesRepository) {}

  findAll() {
    throw new NotImplementedException('Specialties listado pendiente de implementar');
  }
}
