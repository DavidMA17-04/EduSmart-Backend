import { NotImplementedException } from '@nestjs/common';
import { StudentsService } from './students.service';

describe('StudentsService', () => {
  let service: StudentsService;
  let studentsRepository: any;

  beforeEach(() => {
    studentsRepository = {};
    service = new StudentsService(studentsRepository);
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
    expect(() => service.findOne('student-1')).toThrow(NotImplementedException);
  });

  it('update should throw NotImplementedException', () => {
    expect(() => service.update('student-1', {} as never)).toThrow(NotImplementedException);
  });
});
