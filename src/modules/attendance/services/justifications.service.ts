import { Injectable, NotImplementedException } from '@nestjs/common';
import { JustificationsRepository } from '../repositories/justifications.repository';
import { JustifyAbsenceDto } from '../dto/justify-absence.dto';

@Injectable()
export class JustificationsService {
  constructor(private readonly justificationsRepository: JustificationsRepository) {}

  justify(_dto: JustifyAbsenceDto) {
    throw new NotImplementedException('Justificación de ausencia pendiente');
  }
}
