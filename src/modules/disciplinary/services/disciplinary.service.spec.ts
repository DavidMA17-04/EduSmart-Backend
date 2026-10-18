import { NotImplementedException } from '@nestjs/common';
import { DisciplinaryService } from './disciplinary.service';

describe('DisciplinaryService', () => {
  let service: DisciplinaryService;
  let disciplinaryRepository: any;

  beforeEach(() => {
    disciplinaryRepository = {};
    service = new DisciplinaryService(disciplinaryRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('create should throw NotImplementedException', () => {
    expect(() => service.create({} as never)).toThrow(NotImplementedException);
  });

  it('findAll should throw NotImplementedException', () => {
    expect(() => service.findAll({} as never)).toThrow(NotImplementedException);
  });

  it('findOne should throw NotImplementedException', () => {
    expect(() => service.findOne('disc-1')).toThrow(NotImplementedException);
  });

  it('update should throw NotImplementedException', () => {
    expect(() => service.update('disc-1', {} as never)).toThrow(NotImplementedException);
  });
});
