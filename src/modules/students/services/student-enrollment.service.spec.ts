import { NotImplementedException } from '@nestjs/common';
import { StudentEnrollmentService } from './student-enrollment.service';

describe('StudentEnrollmentService', () => {
  let service: StudentEnrollmentService;

  beforeEach(() => {
    service = new StudentEnrollmentService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('assignSection should throw NotImplementedException', () => {
    expect(() => service.assignSection('student-1', 'section-1')).toThrow(
      NotImplementedException,
    );
  });
});
