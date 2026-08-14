import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Student } from './entities/student.entity';
import { Guardian } from './entities/guardian.entity';
import { StudentGuardian } from './entities/student-guardian.entity';
import { StudentsController } from './controllers/students.controller';
import { GuardiansController } from './controllers/guardians.controller';
import { StudentsService } from './services/students.service';
import { GuardiansService } from './services/guardians.service';
import { StudentEnrollmentService } from './services/student-enrollment.service';
import { StudentsRepository } from './repositories/students.repository';
import { GuardiansRepository } from './repositories/guardians.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Student, Guardian, StudentGuardian])],
  controllers: [StudentsController, GuardiansController],
  providers: [
    StudentsService,
    GuardiansService,
    StudentEnrollmentService,
    StudentsRepository,
    GuardiansRepository,
  ],
  exports: [StudentsService, GuardiansService, StudentEnrollmentService],
})
export class StudentsModule {}
