import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) { }

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

  async findById(id: number): Promise<User | null> {
    return this.repository.findOne({ where: { id_users: id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repository.findOne({ where: { email } });
  }

  async findByNationalId(nationalId: string): Promise<User | null> {
    return this.repository.findOne({ where: { national_id: nationalId } });
  }

  async create(userData: Partial<User>): Promise<User> {
    return this.repository.save(this.repository.create(userData));
  }
}

