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
    await this.ensureUniqueCode(dto.code);
    await this.ensureUniqueName(dto.name);

    const specialty = this.repository.create({
      code: dto.code,
      name: dto.name,
      area: dto.area,
      description: dto.description ?? null,
      duration: dto.duration,
      status: dto.status ?? SpecialtyStatus.ACTIVE,
    });

    return this.repository.save(specialty);
  }

  async findAll(): Promise<SpecialtyEntity[]> {
    return this.repository.findAll();
  }

  async findOne(id: string): Promise<SpecialtyEntity> {
    const specialty = await this.repository.findById(id);
    if (!specialty) {
      throw new NotFoundException(`Specialty ${id} not found`);
    }
    return specialty;
  }

  async update(
    id: string,
    dto: UpdateSpecialtyDto,
  ): Promise<SpecialtyEntity> {
    const specialty = await this.findOne(id);

    if (dto.code && dto.code !== specialty.code) {
      await this.ensureUniqueCode(dto.code, id);
      specialty.code = dto.code;
    }

    if (dto.name && dto.name !== specialty.name) {
      await this.ensureUniqueName(dto.name, id);
      specialty.name = dto.name;
    }

    if (dto.area !== undefined) {
      specialty.area = dto.area;
    }

    if (dto.description !== undefined) {
      specialty.description = dto.description ?? null;
    }

    if (dto.duration !== undefined) {
      specialty.duration = dto.duration;
    }

    if (dto.status !== undefined) {
      specialty.status = dto.status;
    }

    return this.repository.save(specialty);
  }

  async remove(id: string): Promise<SpecialtyEntity> {
    const specialty = await this.findOne(id);
    return this.repository.deactivate(specialty);
  }

  private async ensureUniqueCode(
    code: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.repository.findByCode(code);
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Specialty code "${code}" already exists`);
    }
  }

  private async ensureUniqueName(
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.repository.findByName(name);
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Specialty name "${name}" already exists`);
    }
  }
}
