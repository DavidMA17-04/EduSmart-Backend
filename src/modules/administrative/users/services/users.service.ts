import { Injectable } from '@nestjs/common';
import { UsersRepository } from '../repositories/users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly repository: UsersRepository) {}

  findAll() {
    return this.repository.findAll();
  }

  findGuideTeachers() {
    return this.repository.findGuideTeachers();
  }
}
