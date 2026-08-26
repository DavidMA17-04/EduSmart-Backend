import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { INSTITUTIONAL_ROLE_TEACHER } from '../../../../common/constants/institutional-roles.constant';
import { GroupStatus } from '../../../../common/enums/group-status.enum';
import { RoleStatus } from '../../../../common/enums/role-status.enum';
import { UserStatus } from '../../../../common/enums/user-status.enum';
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
    const section = await this.sectionsService.findOne(dto.sectionId);
    await this.ensureUniqueName(dto.sectionId, dto.name);
    if (dto.guideTeacherId) await this.ensureGuideTeacher(dto.guideTeacherId);

    const group = await this.repository.save(
      this.repository.create({
        name: dto.name,
        studentCount: dto.studentCount ?? 0,
        sectionId: dto.sectionId,
        academicPeriodId: dto.academicPeriodId ?? section.academicPeriodId,
        status: dto.status ?? GroupStatus.ACTIVE,
      }),
    );

    if (dto.guideTeacherId) {
      await this.repository.assignGuideTeacher(group, dto.guideTeacherId);
    }

    return this.findOne(group.id);
  }

  async findAll(): Promise<GroupEntity[]> {
    return this.repository.findAll();
  }

  async findOne(id: number): Promise<GroupEntity> {
    const group = await this.repository.findById(id);
    if (!group) throw new NotFoundException(`Group ${id} not found`);
    return group;
  }

  async update(id: number, dto: UpdateGroupDto): Promise<GroupEntity> {
    const group = await this.findOne(id);
    const sectionId = dto.sectionId ?? group.sectionId;
    const name = dto.name ?? group.name;

    if (dto.sectionId && dto.sectionId !== group.sectionId) {
      await this.sectionsService.findOne(dto.sectionId);
    }
    if (sectionId !== group.sectionId || name !== group.name) {
      await this.ensureUniqueName(sectionId, name, id);
    }

    if (dto.sectionId !== undefined) group.sectionId = dto.sectionId;
    if (dto.name !== undefined) group.name = dto.name;
    if (dto.studentCount !== undefined) group.studentCount = dto.studentCount;
    if (dto.status !== undefined) group.status = dto.status;
    if (dto.academicPeriodId !== undefined) {
      group.academicPeriodId = dto.academicPeriodId;
    } else if (dto.sectionId && dto.sectionId !== group.sectionId) {
      const section = await this.sectionsService.findOne(dto.sectionId);
      group.academicPeriodId = section.academicPeriodId;
    }

    await this.repository.save(group);

    if (dto.guideTeacherId !== undefined) {
      if (dto.guideTeacherId) await this.ensureGuideTeacher(dto.guideTeacherId);
      await this.repository.assignGuideTeacher(group, dto.guideTeacherId ?? null);
    }

    return this.findOne(id);
  }

  async assignGuideTeacher(
    id: number,
    dto: AssignGuideTeacherDto,
  ): Promise<GroupEntity> {
    const group = await this.findOne(id);
    if (dto.guideTeacherId) {
      await this.ensureGuideTeacher(dto.guideTeacherId);
    }
    await this.repository.assignGuideTeacher(group, dto.guideTeacherId ?? null);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.repository.remove(await this.findOne(id));
  }

  private async ensureUniqueName(
    sectionId: number,
    name: string,
    excludeId?: number,
  ): Promise<void> {
    const existing = await this.repository.findBySectionAndName(sectionId, name);
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `Group name "${name}" already exists in this section`,
      );
    }
  }

  private async ensureGuideTeacher(id: number): Promise<void> {
    const user = await this.repository.findUserById(id);
    if (!user) {
      throw new NotFoundException(`Guide teacher ${id} not found`);
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new BadRequestException('El docente debe tener una cuenta activa.');
    }
    const isTeacher = user.roles.some(
      (role) =>
        role.name === INSTITUTIONAL_ROLE_TEACHER &&
        role.status === RoleStatus.ACTIVE,
    );
    if (!isTeacher) {
      throw new BadRequestException(
        'Solo usuarios con rol Docente pueden asignarse como docente guía.',
      );
    }
  }
}
