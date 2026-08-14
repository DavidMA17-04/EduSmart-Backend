import { Injectable, NotImplementedException } from '@nestjs/common';
import { CommunicationTargetDto } from '../dto/communication-target.dto';

@Injectable()
export class CommunicationTargetingService {
  setTargets(_communicationId: string, _targets: CommunicationTargetDto[]) {
    throw new NotImplementedException('Segmentación de destinatarios pendiente');
  }
}
