import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AssignGuideTeacherDto } from '../dto/assign-guide-teacher.dto';
import { CreateGroupDto } from '../dto/create-group.dto';
import { UpdateGroupDto } from '../dto/update-group.dto';
import { GroupEntity } from '../entities/group.entity';
import { GroupsRepository } from '../repositories/groups.repository';
import { SectionsService } from './sections.service';

@Injectable()
export class GroupsService {
  constructor(
    private readonly repository: GroupsRepository,
    private readonly sectionsService: SectionsService,
  ) {}

  async create(dto: CreateGroupDto): Promise<GroupEntity> {
    await this.sectionsService.findOne(dto.sectionId);
    await this.ensureUniqueName(dto.sectionId, dto.name);
    if (dto.guideTeacherId) await this.ensureGuideTeacher(dto.guideTeacherId);

    const group = this.repository.create({
      name: dto.name,
      studentCount: dto.studentCount ?? 0,
      sectionId: dto.sectionId,
      guideTeacherId: dto.guideTeacherId ?? null,
    });

    return this.repository.save(group);
  }

  async findAll(): Promise<GroupEntity[]> {
    return this.repository.findAll();
  }

  async findOne(id: string): Promise<GroupEntity> {
    const group = await this.repository.findById(id);
    if (!group) throw new NotFoundException(`Group ${id} not found`);
    return group;
  }

  async update(id: string, dto: UpdateGroupDto): Promise<GroupEntity> {
    const group = await this.findOne(id);
    const sectionId = dto.sectionId ?? group.sectionId;
    const name = dto.name ?? group.name;

    if (dto.sectionId && dto.sectionId !== group.sectionId) {
      await this.sectionsService.findOne(dto.sectionId);
    }
    if (sectionId !== group.sectionId || name !== group.name) {
      await this.ensureUniqueName(sectionId, name, id);
    }
    if (dto.guideTeacherId && dto.guideTeacherId !== group.guideTeacherId) {
      await this.ensureGuideTeacher(dto.guideTeacherId);
    }

    group.sectionId = sectionId;
    group.name = name;
    if (dto.studentCount !== undefined) group.studentCount = dto.studentCount;

    if (dto.guideTeacherId !== undefined) {
      if (dto.guideTeacherId) await this.ensureGuideTeacher(dto.guideTeacherId);
      await this.repository.updateGuideTeacher(id, dto.guideTeacherId);
    }

    if (dto.sectionId !== undefined || dto.name !== undefined || dto.studentCount !== undefined) {
      await this.repository.save({
        id: group.id,
        sectionId,
        name,
        studentCount: dto.studentCount !== undefined ? dto.studentCount : group.studentCount,
      } as GroupEntity);
    }

    return this.findOne(id);
  }

  async assignGuideTeacher(
    id: string,
    dto: AssignGuideTeacherDto,
  ): Promise<GroupEntity> {
    await this.findOne(id);
    if (dto.guideTeacherId) {
      await this.ensureGuideTeacher(dto.guideTeacherId);
    }
    await this.repository.updateGuideTeacher(id, dto.guideTeacherId ?? null);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(await this.findOne(id));
  }

  private async ensureUniqueName(
    sectionId: string,
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.repository.findBySectionAndName(sectionId, name);
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `Group name "${name}" already exists in this section`,
      );
    }
  }

  private async ensureGuideTeacher(id: string): Promise<void> {
    if (!(await this.repository.findUserById(id))) {
      throw new NotFoundException(`Guide teacher ${id} not found`);
    }
  }
}