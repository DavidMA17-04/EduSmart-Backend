import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SectionStatus } from '../../../../common/enums/section-status.enum';
import { AcademicPeriodsRepository } from '../../academic-periods/repositories/academic-periods.repository';
import { SpecialtiesRepository } from '../../specialties/repositories/specialties.repository';
import { CreateSectionDto } from '../dto/create-section.dto';
import { UpdateSectionDto } from '../dto/update-section.dto';
import { SectionEntity } from '../entities/section.entity';
import { SectionsRepository } from '../repositories/sections.repository';

@Injectable()
export class SectionsService {
  constructor(
    private readonly repository: SectionsRepository,
    private readonly academicPeriodsRepository: AcademicPeriodsRepository,
    private readonly specialtiesRepository: SpecialtiesRepository,
  ) {}

  async create(dto: CreateSectionDto): Promise<SectionEntity> {
    await this.ensureAcademicPeriod(dto.academicPeriodId);
    await this.ensureSpecialty(dto.specialtyId);

    const section = this.repository.create({
      name: dto.name.trim(),
      gradeLevel: dto.gradeLevel,
      description: dto.description ?? null,
      academicPeriodId: dto.academicPeriodId,
      specialtyId: dto.specialtyId ?? null,
      status: dto.status ?? SectionStatus.ACTIVE,
    });

    return this.repository.save(section);
  }

  async findAll(): Promise<SectionEntity[]> {
    return this.repository.findAll();
  }

  async findOne(id: number): Promise<SectionEntity> {
    const section = await this.repository.findById(id);
    if (!section) {
      throw new NotFoundException(`Section ${id} not found`);
    }
    return section;
  }

  async update(id: number, dto: UpdateSectionDto): Promise<SectionEntity> {
    const section = await this.findOne(id);

    if (dto.academicPeriodId !== undefined) {
      await this.ensureAcademicPeriod(dto.academicPeriodId);
      section.academicPeriodId = dto.academicPeriodId;
    }
    if (dto.specialtyId !== undefined) {
      await this.ensureSpecialty(dto.specialtyId);
      section.specialtyId = dto.specialtyId ?? null;
    }
    if (dto.name !== undefined) section.name = dto.name.trim();
    if (dto.gradeLevel !== undefined) section.gradeLevel = dto.gradeLevel;
    if (dto.description !== undefined) section.description = dto.description ?? null;
    if (dto.status !== undefined) section.status = dto.status;

    return this.repository.save(section);
  }

  async remove(id: number): Promise<SectionEntity> {
    return this.repository.deactivate(await this.findOne(id));
  }

  private async ensureAcademicPeriod(id: number): Promise<void> {
    const period = await this.academicPeriodsRepository.findById(id);
    if (!period) {
      throw new NotFoundException(`Academic period ${id} not found`);
    }
  }

  private async ensureSpecialty(id?: number | null): Promise<void> {
    if (id == null) return;
    const specialty = await this.specialtiesRepository.findById(id);
    if (!specialty) {
      throw new NotFoundException(`Specialty ${id} not found`);
    }
  }
}
