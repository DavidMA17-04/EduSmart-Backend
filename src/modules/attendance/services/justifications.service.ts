import { Injectable, NotImplementedException } from '@nestjs/common';
import { JustifyAbsenceDto } from '../dto/justify-absence.dto';

/** Stand-by: justifications are out of Phase 1A scope. */
@Injectable()
export class JustificationsService {
  justify(_dto: JustifyAbsenceDto) {
    throw new NotImplementedException('Justificación de ausencia pendiente');
  }
}
