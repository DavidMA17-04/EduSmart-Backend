import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SpecialtyStatus } from '../../../../common/enums/specialty-status.enum';
import { CreateSpecialtyDto } from '../dto/create-specialty.dto';
import { UpdateSpecialtyDto } from '../dto/update-specialty.dto';
import { SpecialtyEntity } from '../entities/specialty.entity';
import { SpecialtiesRepository } from '../repositories/specialties.repository';

@Injectable()
export class SpecialtiesService {
  constructor(private readonly repository: SpecialtiesRepository) {}

  async create(dto: CreateSpecialtyDto): Promise<SpecialtyEntity> {
    await this.ensureUniqueName(dto.name);

    const specialty = this.repository.create({
      name: dto.name.trim(),
      description: dto.description ?? null,
      status: dto.status ?? SpecialtyStatus.ACTIVE,
    });

    return this.repository.save(specialty);
  }

  async findAll(): Promise<SpecialtyEntity[]> {
    return this.repository.findAll();
  }

  async findOne(id: number): Promise<SpecialtyEntity> {
    const specialty = await this.repository.findById(id);
    if (!specialty) {
      throw new NotFoundException(`Specialty ${id} not found`);
    }
    return specialty;
  }

  async update(
    id: number,
    dto: UpdateSpecialtyDto,
  ): Promise<SpecialtyEntity> {
    const specialty = await this.findOne(id);

    if (dto.name && dto.name !== specialty.name) {
      await this.ensureUniqueName(dto.name, id);
      specialty.name = dto.name.trim();
    }

    if (dto.description !== undefined) {
      specialty.description = dto.description ?? null;
    }

    if (dto.status !== undefined) {
      specialty.status = dto.status;
    }

    return this.repository.save(specialty);
  }

  async remove(id: number): Promise<SpecialtyEntity> {
    const specialty = await this.findOne(id);
    return this.repository.deactivate(specialty);
  }

  private async ensureUniqueName(
    name: string,
    excludeId?: number,
  ): Promise<void> {
    const existing = await this.repository.findByName(name.trim());
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Specialty name "${name}" already exists`);
    }
  }
}
