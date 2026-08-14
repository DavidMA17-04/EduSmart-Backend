import { Injectable, NotImplementedException } from '@nestjs/common';
import { FollowUpDisciplinaryActionDto } from '../dto/follow-up-disciplinary-action.dto';

@Injectable()
export class DisciplinaryFollowUpService {
  addFollowUp(_actionId: string, _dto: FollowUpDisciplinaryActionDto) {
    throw new NotImplementedException('Seguimiento disciplinario pendiente');
  }
}
