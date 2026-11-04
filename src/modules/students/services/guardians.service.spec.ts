import { NotImplementedException } from '@nestjs/common';
import { GuardiansService } from './guardians.service';

describe('GuardiansService', () => {
  let service: GuardiansService;
  let guardiansRepository: any;

  beforeEach(() => {
    guardiansRepository = {};
    service = new GuardiansService(guardiansRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('findOne should throw NotImplementedException', () => {
    expect(() => service.findOne('guardian-1')).toThrow(NotImplementedException);
  });

  it('assignToStudent should throw NotImplementedException', () => {
    expect(() => service.assignToStudent('student-1', {} as never)).toThrow(NotImplementedException);
  });
});
