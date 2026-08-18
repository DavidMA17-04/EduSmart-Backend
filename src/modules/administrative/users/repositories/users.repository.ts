import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  async findAll(): Promise<User[]> {
    return this.repository.find({ order: { name: 'ASC' } });
  }

  async findGuideTeachers(): Promise<User[]> {
    return this.repository
      .createQueryBuilder('user')
      .where('user.name IS NOT NULL')
      .orderBy('user.name', 'ASC')
      .getMany();
  }

  async findById(id: string): Promise<User | null> {
    return this.repository.findOne({ where: { id } });
  }

  async createGuideTeacher(id: string, name: string): Promise<User> {
    return this.repository.save(this.repository.create({ id, name }));
  }
}
