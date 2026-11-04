import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupEntity } from '../sections/entities/group.entity';
import { User } from '../users/entities/user.entity';
import { GroupEnrollmentsController } from './controllers/group-enrollments.controller';
import { GroupEnrollment } from './entities/group-enrollment.entity';
import { GroupEnrollmentsService } from './services/group-enrollments.service';

@Module({
  imports: [TypeOrmModule.forFeature([GroupEnrollment, GroupEntity, User])],
  controllers: [GroupEnrollmentsController],
  providers: [GroupEnrollmentsService],
  exports: [GroupEnrollmentsService],
})
export class GroupEnrollmentsModule {}
