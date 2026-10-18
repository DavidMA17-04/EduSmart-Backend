import { ConflictException, NotFoundException } from '@nestjs/common';
import { SpecialtyKind } from '../../../../common/enums/specialty-kind.enum';
import { SpecialtyStatus } from '../../../../common/enums/specialty-status.enum';
import { SpecialtyEntity } from '../entities/specialty.entity';
import { SpecialtiesService } from './specialties.service';

describe('SpecialtiesService', () => {
  let service: SpecialtiesService;
  let repository: {
    findByName: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    findAll: jest.Mock;
    findById: jest.Mock;
    deactivate: jest.Mock;
    countByKind: jest.Mock;
  };

  const mockSpecialty: SpecialtyEntity = {
    id: 1,
    name: 'Informática',
    description: 'Especialidad técnica de desarrollo',
    status: SpecialtyStatus.ACTIVE,
    kind: SpecialtyKind.TECHNICAL_SPECIALTY,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    repository = {
      findByName: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((data) => ({ ...data })),
      save: jest.fn().mockImplementation((data) => Promise.resolve({ id: 1, ...data })),
      findAll: jest.fn().mockResolvedValue([mockSpecialty]),
      findById: jest.fn().mockResolvedValue({ ...mockSpecialty }),
      deactivate: jest.fn().mockImplementation((entity) =>
        Promise.resolve({ ...entity, status: SpecialtyStatus.INACTIVE }),
      ),
      countByKind: jest.fn().mockResolvedValue(3),
    };

    service = new SpecialtiesService(repository as never);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a specialty when name is unique', async () => {
      const dto = {
        name: ' Agropecuaria ',
        description: 'Campo agrícola',
        kind: SpecialtyKind.TECHNICAL_SPECIALTY,
      };

      const result = await service.create(dto);
      expect(result.name).toBe('Agropecuaria');
      expect(repository.findByName).toHaveBeenCalledWith('Agropecuaria');
      expect(repository.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if specialty name already exists', async () => {
      repository.findByName.mockResolvedValue(mockSpecialty);

      await expect(service.create({ name: 'Informática' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all specialties', async () => {
      const result = await service.findAll();
      expect(result).toEqual([mockSpecialty]);
      expect(repository.findAll).toHaveBeenCalledWith(undefined);
    });

    it('should pass kind filter to repository', async () => {
      await service.findAll(SpecialtyKind.EXPLORATORY_WORKSHOP);
      expect(repository.findAll).toHaveBeenCalledWith(
        SpecialtyKind.EXPLORATORY_WORKSHOP,
      );
    });
  });

  describe('findOne', () => {
    it('should return specialty when found', async () => {
      const result = await service.findOne(1);
      expect(result).toEqual(mockSpecialty);
    });

    it('should throw NotFoundException if specialty not found', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update specialty successfully', async () => {
      const result = await service.update(1, { description: 'Nueva descripción' });
      expect(result.description).toBe('Nueva descripción');
      expect(repository.save).toHaveBeenCalled();
    });

    it('should throw ConflictException when updating to an existing name of another specialty', async () => {
      repository.findByName.mockResolvedValue({ id: 2, name: 'Turismo' });

      await expect(service.update(1, { name: 'Turismo' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('remove', () => {
    it('should deactivate specialty', async () => {
      const result = await service.remove(1);
      expect(result.status).toBe(SpecialtyStatus.INACTIVE);
      expect(repository.deactivate).toHaveBeenCalled();
    });
  });

  describe('countByKind', () => {
    it('should return count for given kind', async () => {
      const count = await service.countByKind(SpecialtyKind.TECHNICAL_SPECIALTY);
      expect(count).toBe(3);
      expect(repository.countByKind).toHaveBeenCalledWith(
        SpecialtyKind.TECHNICAL_SPECIALTY,
      );
    });
  });
});
