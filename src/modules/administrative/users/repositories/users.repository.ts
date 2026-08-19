import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  create(data: Partial<User>): User {
    return this.repository.create(data);
  }

  async save(entity: User): Promise<User> {
    return this.repository.save(entity);
  }

  async findAll(): Promise<User[]> {
    return this.repository.find({
      relations: { roles: true },
      order: { name: 'ASC' },
    });
  }

  async findGuideTeachers(): Promise<User[]> {
    return this.repository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'roles')
      .where('user.name IS NOT NULL')
      .orderBy('user.name', 'ASC')
      .getMany();
  }

  async findById(id: string): Promise<User | null> {
    return this.repository.findOne({
      where: { id },
      relations: { roles: true },
    });
  }

  async findByNationalId(
    nationalId: string,
    excludeId?: string,
  ): Promise<User | null> {
    return this.repository.findOne({
      where: excludeId
        ? { nationalId, id: Not(excludeId) }
        : { nationalId },
    });
  }

  async findByEmail(email: string, excludeId?: string): Promise<User | null> {
    return this.repository.findOne({
      where: excludeId ? { email, id: Not(excludeId) } : { email },
    });
  }

  async createGuideTeacher(id: string, name: string): Promise<User> {
    return this.repository.save(this.repository.create({ id, name }));
  }
}
