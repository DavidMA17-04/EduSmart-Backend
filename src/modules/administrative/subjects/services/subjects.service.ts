import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SubjectStatus } from '../../../../common/enums/subject-status.enum';
import { CreateSubjectDto } from '../dto/create-subject.dto';
import { UpdateSubjectDto } from '../dto/update-subject.dto';
import { SubjectEntity } from '../entities/subject.entity';
import { SubjectsRepository } from '../repositories/subjects.repository';

@Injectable()
export class SubjectsService {
  constructor(private readonly repository: SubjectsRepository) {}

  async create(dto: CreateSubjectDto): Promise<SubjectEntity> {
    const existing = await this.repository.findByName(dto.name.trim());
    if (existing) {
      throw new ConflictException(`Subject "${dto.name}" already exists`);
    }
    return this.repository.save(
      this.repository.create({
        name: dto.name.trim(),
        code: dto.code?.trim() || null,
        status: dto.status ?? SubjectStatus.ACTIVE,
      }),
    );
  }

  findAll(): Promise<SubjectEntity[]> {
    return this.repository.findAll();
  }

  async findOne(id: number): Promise<SubjectEntity> {
    const subject = await this.repository.findById(id);
    if (!subject) throw new NotFoundException(`Subject ${id} not found`);
    return subject;
  }

  async update(id: number, dto: UpdateSubjectDto): Promise<SubjectEntity> {
    const subject = await this.findOne(id);
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      const existing = await this.repository.findByName(name);
      if (existing && existing.id !== id) {
        throw new ConflictException(`Subject "${name}" already exists`);
      }
      subject.name = name;
    }
    if (dto.code !== undefined) {
      subject.code = dto.code?.trim() || null;
    }
    if (dto.status !== undefined) subject.status = dto.status;
    return this.repository.save(subject);
  }

  async remove(id: number): Promise<SubjectEntity> {
    const subject = await this.findOne(id);
    subject.status = SubjectStatus.INACTIVE;
    return this.repository.save(subject);
  }
}
