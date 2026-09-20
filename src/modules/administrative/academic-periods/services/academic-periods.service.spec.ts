import { BadRequestException } from '@nestjs/common';
import { AcademicPeriodsService } from './academic-periods.service';

describe('AcademicPeriodsService date overlap', () => {
  const repository = {
    findAll: jest.fn(),
    findById: jest.fn(),
    findByAcademicYearId: jest.fn(),
    findActive: jest.fn(),
    findOverlapping: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const academicYearsRepository = {
    findById: jest.fn(),
    findActive: jest.fn(),
  };

  let service: AcademicPeriodsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AcademicPeriodsService(
      repository as never,
      academicYearsRepository as never,
    );
    academicYearsRepository.findById.mockResolvedValue({ id: 1, name: 'Año 2026' });
    repository.findOverlapping.mockResolvedValue([]);
    repository.create.mockImplementation(async (data) => ({ id: 10, ...data }));
  });

  it('crea curso lectivo cuando no hay solapamiento', async () => {
    await expect(
      service.create({
        name: 'I Semestre',
        startDate: '2026-02-01',
        endDate: '2026-06-30',
        academicYearId: 1,
      }),
    ).resolves.toMatchObject({ name: 'I Semestre', academicYearId: 1 });

    expect(repository.findOverlapping).toHaveBeenCalledWith({
      academicYearId: 1,
      startDate: '2026-02-01',
      endDate: '2026-06-30',
    });
  });

  it('rechaza create con solapamiento de fechas (400)', async () => {
    repository.findOverlapping.mockResolvedValue([
      { id: 2, name: 'Curso previo', startDate: '2026-01-01', endDate: '2026-03-31' },
    ]);

    await expect(
      service.create({
        name: 'Traslapado',
        startDate: '2026-03-01',
        endDate: '2026-06-30',
        academicYearId: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza update cuando las nuevas fechas se solapan', async () => {
    repository.findById.mockResolvedValue({
      id: 5,
      name: 'II Semestre',
      startDate: '2026-07-01',
      endDate: '2026-11-30',
      academicYearId: 1,
      status: 'PLANNED',
    });
    repository.findOverlapping.mockResolvedValue([
      { id: 2, name: 'I Semestre', startDate: '2026-02-01', endDate: '2026-07-15' },
    ]);

    await expect(
      service.update(5, { startDate: '2026-06-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('permite rangos adyacentes sin overlap (findOverlapping vacío)', async () => {
    repository.findOverlapping.mockResolvedValue([]);
    await expect(
      service.create({
        name: 'II Semestre',
        startDate: '2026-07-01',
        endDate: '2026-11-30',
        academicYearId: 1,
      }),
    ).resolves.toBeDefined();
  });
});
