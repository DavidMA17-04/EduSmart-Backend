import { ConflictException, NotFoundException } from '@nestjs/common';
import { SubjectStatus } from '../../../../common/enums/subject-status.enum';
import { SubjectEntity } from '../entities/subject.entity';
import { SubjectsService } from './subjects.service';

describe('SubjectsService', () => {
  let service: SubjectsService;
  let repository: {
    findByName: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    findAll: jest.Mock;
    findById: jest.Mock;
  };

  const mockSubject: SubjectEntity = {
    id: 1,
    name: 'Matemáticas',
    code: 'MAT-101',
    status: SubjectStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    repository = {
      findByName: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((data) => ({ ...data })),
      save: jest.fn().mockImplementation((data) => Promise.resolve({ id: 1, ...data })),
      findAll: jest.fn().mockResolvedValue([mockSubject]),
      findById: jest.fn().mockResolvedValue({ ...mockSubject }),
    };

    service = new SubjectsService(repository as never);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a subject when name is unique', async () => {
      const dto = { name: ' Matemáticas ', code: ' MAT-101 ' };
      const result = await service.create(dto);

      expect(result.name).toBe('Matemáticas');
      expect(result.code).toBe('MAT-101');
      expect(repository.findByName).toHaveBeenCalledWith('Matemáticas');
      expect(repository.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if subject name already exists', async () => {
      repository.findByName.mockResolvedValue(mockSubject);

      await expect(service.create({ name: 'Matemáticas' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all subjects', async () => {
      const result = await service.findAll();
      expect(result).toEqual([mockSubject]);
    });
  });

  describe('findOne', () => {
    it('should return a subject if found', async () => {
      const result = await service.findOne(1);
      expect(result).toEqual(mockSubject);
    });

    it('should throw NotFoundException if subject does not exist', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update name and code successfully', async () => {
      const result = await service.update(1, { name: 'Física', code: 'FIS-101' });

      expect(result.name).toBe('Física');
      expect(result.code).toBe('FIS-101');
      expect(repository.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if updated name belongs to another subject', async () => {
      repository.findByName.mockResolvedValue({ id: 2, name: 'Física' });

      await expect(service.update(1, { name: 'Física' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('remove', () => {
    it('should soft-delete subject by setting status to INACTIVE', async () => {
      const result = await service.remove(1);
      expect(result.status).toBe(SubjectStatus.INACTIVE);
      expect(repository.save).toHaveBeenCalled();
    });
  });
});
