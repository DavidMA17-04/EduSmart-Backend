import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { UsersRepository } from '../repositories/users.repository';
import { GUIDE_TEACHER_SEED } from '../constants/guide-teacher.seed';

@Injectable()
export class UsersBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(UsersBootstrapService.name);

  constructor(private readonly usersRepository: UsersRepository) {}

  async onModuleInit(): Promise<void> {
    for (const teacher of GUIDE_TEACHER_SEED) {
      const existing = await this.usersRepository.findById(teacher.id);
      if (existing) continue;
      await this.usersRepository.createGuideTeacher(teacher.id, teacher.name);
      this.logger.log(`Guide teacher seeded: ${teacher.name}`);
    }
  }
}
