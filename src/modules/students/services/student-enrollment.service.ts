import { Injectable, NotImplementedException } from '@nestjs/common';

@Injectable()
export class StudentEnrollmentService {
  assignSection(_studentId: string, _sectionId: string) {
    throw new NotImplementedException('Asignación de sección pendiente');
  }
}
