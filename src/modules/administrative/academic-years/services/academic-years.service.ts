import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateAcademicYearDto } from '../dto/create-academic-year.dto';
import { UpdateAcademicYearDto } from '../dto/update-academic-year.dto';
import { AcademicYear } from '../entities/academic-year.entity';
import { AcademicYearStatus } from '../enums/academic-year-status.enum';
import { AcademicYearsRepository } from '../repositories/academic-years.repository';

@Injectable()
export class AcademicYearsService {
  constructor(private readonly repository: AcademicYearsRepository) {}

  findAll(): Promise<AcademicYear[]> {
    return this.repository.findAll();
  }

  findActive(): Promise<AcademicYear | null> {
    return this.repository.findActive();
  }

  async findOne(id: number): Promise<AcademicYear> {
    const year = await this.repository.findById(id);
    if (!year) {
      throw new NotFoundException('Año lectivo no encontrado');
    }
    return year;
  }

  create(dto: CreateAcademicYearDto): Promise<AcademicYear> {
    if (dto.startDate >= dto.endDate) {
      throw new BadRequestException(
        'La fecha de inicio del año lectivo debe ser anterior a la fecha de finalización',
      );
    }

    return this.repository.create({
      name: dto.name.trim(),
      startDate: dto.startDate,
      endDate: dto.endDate,
      status: AcademicYearStatus.PLANNED,
    });
  }

  async update(id: number, dto: UpdateAcademicYearDto): Promise<AcademicYear> {
    const year = await this.findOne(id);

    if (year.status === AcademicYearStatus.CLOSED) {
      throw new BadRequestException('No se puede editar un año lectivo cerrado');
    }

    const startDate = dto.startDate ?? year.startDate;
    const endDate = dto.endDate ?? year.endDate;
    if (startDate >= endDate) {
      throw new BadRequestException(
        'La fecha de inicio del año lectivo debe ser anterior a la fecha de finalización',
      );
    }

    if (dto.name !== undefined) year.name = dto.name.trim();
    if (dto.startDate !== undefined) year.startDate = dto.startDate;
    if (dto.endDate !== undefined) year.endDate = dto.endDate;

    return this.repository.save(year);
  }

  async activate(id: number): Promise<AcademicYear> {
    const year = await this.findOne(id);
    if (year.status === AcademicYearStatus.CLOSED) {
      throw new BadRequestException('No se puede activar un año lectivo cerrado');
    }

    await this.repository.clearActiveExcept(id);
    year.status = AcademicYearStatus.ACTIVE;
    return this.repository.save(year);
  }

  async close(id: number): Promise<AcademicYear> {
    const year = await this.findOne(id);
    year.status = AcademicYearStatus.CLOSED;
    return this.repository.save(year);
  }
}
