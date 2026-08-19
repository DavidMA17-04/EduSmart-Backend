import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { GroupEntity } from '../entities/group.entity';

@Injectable()
export class GroupsRepository {
  constructor(
    @InjectRepository(GroupEntity)
    private readonly repository: Repository<GroupEntity>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  create(data: Partial<GroupEntity>): GroupEntity {
    return this.repository.create(data);
  }

  async save(entity: GroupEntity): Promise<GroupEntity> {
    return this.repository.save(entity);
  }

  async updateGuideTeacher(id: string, guideTeacherId: string | null): Promise<void> {
    await this.repository.update({ id }, { guideTeacherId });
  }

  async findAll(): Promise<GroupEntity[]> {
    return this.repository.find({
      relations: { section: true, guideTeacher: true },
      order: { name: 'ASC' },
    });
  }

  async findById(id: string): Promise<GroupEntity | null> {
    return this.repository.findOne({
      where: { id },
      relations: { section: true, guideTeacher: true },
    });
  }

  async findBySectionAndName(
    sectionId: string,
    name: string,
  ): Promise<GroupEntity | null> {
    return this.repository.findOne({ where: { sectionId, name } });
  }

  async findUserById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async remove(entity: GroupEntity): Promise<GroupEntity> {
    return this.repository.remove(entity);
  }
}