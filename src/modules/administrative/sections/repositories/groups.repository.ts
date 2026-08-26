import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeachingAssignment } from '../../teaching-assignments/entities/teaching-assignment.entity';
import { User } from '../../users/entities/user.entity';
import { GroupEntity } from '../entities/group.entity';

@Injectable()
export class GroupsRepository {
  constructor(
    @InjectRepository(GroupEntity)
    private readonly repository: Repository<GroupEntity>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(TeachingAssignment)
    private readonly teachingAssignments: Repository<TeachingAssignment>,
  ) {}

  create(data: Partial<GroupEntity>): GroupEntity {
    return this.repository.create(data);
  }

  async save(entity: GroupEntity): Promise<GroupEntity> {
    return this.repository.save(entity);
  }

  async findAll(): Promise<GroupEntity[]> {
    const groups = await this.repository.find({
      relations: { section: true, academicPeriod: true },
      order: { name: 'ASC' },
    });
    return this.attachGuideTeachers(groups);
  }

  async findById(id: number): Promise<GroupEntity | null> {
    const group = await this.repository.findOne({
      where: { id },
      relations: { section: true, academicPeriod: true },
    });
    if (!group) return null;
    const [withGuide] = await this.attachGuideTeachers([group]);
    return withGuide;
  }

  async findBySectionAndName(
    sectionId: number,
    name: string,
  ): Promise<GroupEntity | null> {
    return this.repository.findOne({ where: { sectionId, name } });
  }

  async findUserById(id: number): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
      relations: { userRoles: { role: true } },
    });
  }

  async assignGuideTeacher(
    group: GroupEntity,
    teacherId: number | null,
  ): Promise<void> {
    await this.teachingAssignments.update(
      { groupId: group.id, isGuideTeacher: true },
      { isGuideTeacher: false },
    );

    if (!teacherId) return;

    const existing = await this.teachingAssignments.findOne({
      where: { groupId: group.id, userId: teacherId },
    });

    if (existing) {
      existing.isGuideTeacher = true;
      existing.academicPeriodId = group.academicPeriodId;
      await this.teachingAssignments.save(existing);
      return;
    }

    await this.teachingAssignments.save(
      this.teachingAssignments.create({
        groupId: group.id,
        userId: teacherId,
        academicPeriodId: group.academicPeriodId,
        isGuideTeacher: true,
      }),
    );
  }

  async remove(entity: GroupEntity): Promise<GroupEntity> {
    return this.repository.remove(entity);
  }

  private async attachGuideTeachers(groups: GroupEntity[]): Promise<GroupEntity[]> {
    if (!groups.length) return groups;
    const assignments = await this.teachingAssignments.find({
      where: groups.map((group) => ({
        groupId: group.id,
        isGuideTeacher: true,
      })),
      relations: { user: true },
    });
    const byGroup = new Map(assignments.map((item) => [item.groupId, item]));
    for (const group of groups) {
      const assignment = byGroup.get(group.id);
      group.guideTeacher = assignment?.user ?? null;
      group.guideTeacherId = assignment?.userId ?? null;
    }
    return groups;
  }
}
