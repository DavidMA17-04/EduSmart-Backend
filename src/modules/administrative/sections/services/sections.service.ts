import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SectionStatus } from '../../../../common/enums/section-status.enum';
import { CreateSectionDto } from '../dto/create-section.dto';
import { UpdateSectionDto } from '../dto/update-section.dto';
import { SectionEntity } from '../entities/section.entity';
import { SectionsRepository } from '../repositories/sections.repository';

@Injectable()
export class SectionsService {
  constructor(private readonly repository: SectionsRepository) {}

  async create(dto: CreateSectionDto): Promise<SectionEntity> {
    await this.ensureUniqueCode(dto.code);

    const section = this.repository.create({
      code: dto.code,
      name: dto.name,
      description: dto.description ?? null,
      status: dto.status ?? SectionStatus.ACTIVE,
    });

    return this.repository.save(section);
  }

  async findAll(): Promise<SectionEntity[]> {
    return this.repository.findAll();
  }

  async findOne(id: string): Promise<SectionEntity> {
    const section = await this.repository.findById(id);
    if (!section) {
      throw new NotFoundException(`Section ${id} not found`);
    }
    return section;
  }

  async update(id: string, dto: UpdateSectionDto): Promise<SectionEntity> {
    const section = await this.findOne(id);

    if (dto.code && dto.code !== section.code) {
      await this.ensureUniqueCode(dto.code, id);
      section.code = dto.code;
    }
    if (dto.name !== undefined) section.name = dto.name;
    if (dto.description !== undefined) section.description = dto.description ?? null;
    if (dto.status !== undefined) section.status = dto.status;

    return this.repository.save(section);
  }

  async remove(id: string): Promise<SectionEntity> {
    return this.repository.deactivate(await this.findOne(id));
  }

  private async ensureUniqueCode(
    code: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.repository.findByCode(code);
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Section code "${code}" already exists`);
    }
  }
}