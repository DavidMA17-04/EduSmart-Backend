import { NotImplementedException } from '@nestjs/common';
import { AppealsService } from './appeals.service';

describe('AppealsService', () => {
  let service: AppealsService;
  let appealsRepository: any;

  beforeEach(() => {
    appealsRepository = {};
    service = new AppealsService(appealsRepository);
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
    expect(() => service.findOne('appeal-1')).toThrow(NotImplementedException);
  });

  it('review should throw NotImplementedException', () => {
    expect(() => service.review('appeal-1', {} as never)).toThrow(
      NotImplementedException,
    );
  });
});
