import { NotImplementedException } from '@nestjs/common';
import { CommunicationsService } from './communications.service';

describe('CommunicationsService', () => {
  let service: CommunicationsService;
  let communicationsRepository: any;

  beforeEach(() => {
    communicationsRepository = {};
    service = new CommunicationsService(communicationsRepository);
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

  it('update should throw NotImplementedException', () => {
    expect(() => service.update('comm-1', {} as never)).toThrow(NotImplementedException);
  });
});
