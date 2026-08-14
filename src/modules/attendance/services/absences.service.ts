import { Injectable, NotImplementedException } from '@nestjs/common';
import { RegisterAbsenceDto } from '../dto/register-absence.dto';

@Injectable()
export class AbsencesService {
  register(_dto: RegisterAbsenceDto) {
    throw new NotImplementedException('Registro de ausencia pendiente');
  }
}
