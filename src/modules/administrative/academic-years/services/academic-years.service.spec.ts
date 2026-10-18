import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AcademicYearsService } from './academic-years.service';
import { AcademicYearStatus } from '../enums/academic-year-status.enum';
import { AcademicYear } from '../entities/academic-year.entity';

describe('AcademicYearsService', () => {
  let service: AcademicYearsService;
  let repository: {
    findAll: jest.Mock;
    findActive: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    clearActiveExcept: jest.Mock;
  };

  const mockYear: AcademicYear = {
    id: 1,
    name: '2026',
    startDate: '2026-02-01',
    endDate: '2026-11-30',
    status: AcademicYearStatus.PLANNED,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    repository = {
      findAll: jest.fn().mockResolvedValue([mockYear]),
      findActive: jest.fn().mockResolvedValue(mockYear),
      findById: jest.fn().mockResolvedValue({ ...mockYear }),
      create: jest.fn().mockImplementation((data) => Promise.resolve({ id: 2, ...data })),
      save: jest.fn().mockImplementation((data) => Promise.resolve({ ...data })),
      clearActiveExcept: jest.fn().mockResolvedValue(undefined),
    };

    service = new AcademicYearsService(repository as never);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all academic years', async () => {
      const result = await service.findAll();
      expect(result).toEqual([mockYear]);
      expect(repository.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('findActive', () => {
    it('should return the active academic year', async () => {
      const result = await service.findActive();
      expect(result).toEqual(mockYear);
      expect(repository.findActive).toHaveBeenCalledTimes(1);
    });
  });

  describe('findOne', () => {
    it('should return the academic year if found', async () => {
      const result = await service.findOne(1);
      expect(result).toEqual(mockYear);
    });

    it('should throw NotFoundException if not found', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create an academic year when dates are valid', async () => {
      const dto = {
        name: ' 2027 ',
        startDate: '2027-02-01',
        endDate: '2027-11-30',
      };

      const result = await service.create(dto);
      expect(result.name).toBe('2027');
      expect(result.status).toBe(AcademicYearStatus.PLANNED);
      expect(repository.create).toHaveBeenCalledWith({
        name: '2027',
        startDate: '2027-02-01',
        endDate: '2027-11-30',
        status: AcademicYearStatus.PLANNED,
      });
    });

    it('should throw BadRequestException if startDate >= endDate', () => {
      const dto = {
        name: '2027',
        startDate: '2027-12-01',
        endDate: '2027-01-01',
      };

      expect(() => service.create(dto)).toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should update an academic year successfully', async () => {
      const dto = {
        name: '2026 Modificado',
        startDate: '2026-03-01',
        endDate: '2026-12-01',
      };

      const result = await service.update(1, dto);
      expect(result.name).toBe('2026 Modificado');
      expect(result.startDate).toBe('2026-03-01');
      expect(repository.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if academic year is CLOSED', async () => {
      repository.findById.mockResolvedValue({
        ...mockYear,
        status: AcademicYearStatus.CLOSED,
      });

      await expect(service.update(1, { name: '2026' })).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if new startDate >= endDate', async () => {
      await expect(
        service.update(1, { startDate: '2026-12-31', endDate: '2026-01-01' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('activate', () => {
    it('should activate a non-closed academic year', async () => {
      const result = await service.activate(1);
      expect(repository.clearActiveExcept).toHaveBeenCalledWith(1);
      expect(result.status).toBe(AcademicYearStatus.ACTIVE);
      expect(repository.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if activating a CLOSED academic year', async () => {
      repository.findById.mockResolvedValue({
        ...mockYear,
        status: AcademicYearStatus.CLOSED,
      });

      await expect(service.activate(1)).rejects.toThrow(BadRequestException);
    });
  });

  describe('close', () => {
    it('should close an academic year', async () => {
      const result = await service.close(1);
      expect(result.status).toBe(AcademicYearStatus.CLOSED);
      expect(repository.save).toHaveBeenCalled();
    });
  });
});
