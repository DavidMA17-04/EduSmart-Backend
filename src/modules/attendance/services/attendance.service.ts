import { Injectable, NotImplementedException } from '@nestjs/common';
import { AttendanceRepository } from '../repositories/attendance.repository';
import { RegisterAttendanceDto } from '../dto/register-attendance.dto';
import { AttendanceFilterDto } from '../dto/attendance-filter.dto';

@Injectable()
export class AttendanceService {
  constructor(private readonly attendanceRepository: AttendanceRepository) {}

  register(_dto: RegisterAttendanceDto) {
    throw new NotImplementedException('Registro de asistencia pendiente');
  }

  findAll(_filter: AttendanceFilterDto) {
    throw new NotImplementedException('Consulta de asistencia pendiente');
  }
}
