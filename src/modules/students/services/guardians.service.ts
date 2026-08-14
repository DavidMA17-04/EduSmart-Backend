import { Injectable, NotImplementedException } from '@nestjs/common';
import { GuardiansRepository } from '../repositories/guardians.repository';
import { AssignGuardianDto } from '../dto/assign-guardian.dto';

@Injectable()
export class GuardiansService {
  constructor(private readonly guardiansRepository: GuardiansRepository) {}

  findOne(_id: string) {
    throw new NotImplementedException('Consulta de encargado pendiente');
  }

  assignToStudent(_studentId: string, _dto: AssignGuardianDto) {
    throw new NotImplementedException('Asociación de encargado pendiente');
  }
}
