import { NotFoundException } from '@nestjs/common';
import { SectionStatus } from '../../../../common/enums/section-status.enum';
import { SectionEntity } from '../entities/section.entity';
import { SectionsService } from './sections.service';

describe('SectionsService', () => {
  let service: SectionsService;
  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    findAll: jest.Mock;
    findById: jest.Mock;
    deactivate: jest.Mock;
  };
  let academicPeriodsRepository: {
    findById: jest.Mock;
    findByAcademicYearId: jest.Mock;
    findActive: jest.Mock;
  };
  let academicYearsRepository: {
    findActive: jest.Mock;
  };
  let specialtiesRepository: {
    findById: jest.Mock;
  };

  const mockSection: SectionEntity = {
    id: 1,
    name: '10-1',
    gradeLevel: 10,
    description: 'Sección décimo',
    academicPeriodId: 1,
    specialtyId: 2,
    status: SectionStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    academicPeriod: { id: 1, name: 'Semestre 1' } as never,
    specialty: { id: 2, name: 'Informática' } as never,
    groups: [],
  };

  beforeEach(() => {
    repository = {
      create: jest.fn().mockImplementation((data) => ({ ...data })),
      save: jest.fn().mockImplementation((data) => Promise.resolve({ id: 1, ...data })),
      findAll: jest.fn().mockResolvedValue([mockSection]),
      findById: jest.fn().mockResolvedValue({ ...mockSection }),
      deactivate: jest.fn().mockImplementation((entity) =>
        Promise.resolve({ ...entity, status: SectionStatus.INACTIVE }),
      ),
    };

    academicPeriodsRepository = {
      findById: jest.fn().mockResolvedValue({ id: 1, name: 'Semestre 1' }),
      findByAcademicYearId: jest.fn().mockResolvedValue([{ id: 1 }]),
      findActive: jest.fn().mockResolvedValue([{ id: 1 }]),
    };

    academicYearsRepository = {
      findActive: jest.fn().mockResolvedValue({ id: 10, name: '2026' }),
    };

    specialtiesRepository = {
      findById: jest.fn().mockResolvedValue({ id: 2, name: 'Informática' }),
    };

    service = new SectionsService(
      repository as never,
      academicPeriodsRepository as never,
      academicYearsRepository as never,
      specialtiesRepository as never,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create section when relations are valid', async () => {
      const dto = {
        name: ' 10-1 ',
        gradeLevel: 10,
        academicPeriodId: 1,
        specialtyId: 2,
      };

      const result = await service.create(dto);
      expect(result.name).toBe('10-1');
      expect(repository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if academic period does not exist', async () => {
      academicPeriodsRepository.findById.mockResolvedValue(null);

      await expect(
        service.create({
          name: '10-1',
          gradeLevel: 10,
          academicPeriodId: 999,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if specialty is given but does not exist', async () => {
      specialtiesRepository.findById.mockResolvedValue(null);

      await expect(
        service.create({
          name: '10-1',
          gradeLevel: 10,
          academicPeriodId: 1,
          specialtyId: 999,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return all sections', async () => {
      const result = await service.findAll();
      expect(result).toEqual([mockSection]);
    });
  });

  describe('findVisibleForTeacher', () => {
    it('should filter sections by active academic periods', async () => {
      const result = await service.findVisibleForTeacher();
      expect(result).toEqual([mockSection]);
      expect(academicYearsRepository.findActive).toHaveBeenCalled();
      expect(academicPeriodsRepository.findByAcademicYearId).toHaveBeenCalledWith(10);
    });

    it('should return empty list if no active periods exist', async () => {
      academicYearsRepository.findActive.mockResolvedValue(null);
      academicPeriodsRepository.findActive.mockResolvedValue([]);

      const result = await service.findVisibleForTeacher();
      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return section when found', async () => {
      const result = await service.findOne(1);
      expect(result).toEqual(mockSection);
    });

    it('should throw NotFoundException when not found', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update section details', async () => {
      const result = await service.update(1, { name: '10-2', gradeLevel: 10 });
      expect(result.name).toBe('10-2');
      expect(repository.save).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should deactivate section', async () => {
      const result = await service.remove(1);
      expect(result.status).toBe(SectionStatus.INACTIVE);
      expect(repository.deactivate).toHaveBeenCalled();
    });
  });
});
