import { Injectable, NotImplementedException } from '@nestjs/common';

@Injectable()
export class ReadingConfirmationService {
  confirmRead(_communicationId: string, _userId: string) {
    throw new NotImplementedException('Confirmación de lectura pendiente');
  }
}
