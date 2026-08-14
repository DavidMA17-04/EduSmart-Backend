import { Injectable, NotImplementedException } from '@nestjs/common';
import { ResolveAppealDto } from '../dto/resolve-appeal.dto';

@Injectable()
export class AppealResolutionService {
  resolve(_appealId: string, _dto: ResolveAppealDto) {
    throw new NotImplementedException('Resolución de apelación pendiente');
  }
}
