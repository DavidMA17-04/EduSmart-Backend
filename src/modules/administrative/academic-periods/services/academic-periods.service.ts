import { Injectable, NotImplementedException } from '@nestjs/common';
import { AcademicPeriodsRepository } from '../repositories/academic-periods.repository';

@Injectable()
export class AcademicPeriodsService {
  constructor(private readonly repository: AcademicPeriodsRepository) {}

  findAll() {
    throw new NotImplementedException('AcademicPeriods listado pendiente de implementar');
  }
}
