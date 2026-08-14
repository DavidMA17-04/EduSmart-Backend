import { Injectable, NotImplementedException } from '@nestjs/common';
import { StudentsRepository } from '../repositories/students.repository';
import { CreateStudentDto } from '../dto/create-student.dto';
import { UpdateStudentDto } from '../dto/update-student.dto';
import { StudentFilterDto } from '../dto/student-filter.dto';

@Injectable()
export class StudentsService {
  constructor(private readonly studentsRepository: StudentsRepository) {}

  create(_dto: CreateStudentDto) {
    throw new NotImplementedException('Registro de estudiante pendiente');
  }

  findAll(_filter: StudentFilterDto) {
    throw new NotImplementedException('Listado de estudiantes pendiente');
  }

  findOne(_id: string) {
    throw new NotImplementedException('Consulta de estudiante pendiente');
  }

  update(_id: string, _dto: UpdateStudentDto) {
    throw new NotImplementedException('Actualización de estudiante pendiente');
  }
}
