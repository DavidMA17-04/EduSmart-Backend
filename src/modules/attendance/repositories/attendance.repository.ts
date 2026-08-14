import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attendance } from '../entities/attendance.entity';

@Injectable()
export class AttendanceRepository {
  constructor(
    @InjectRepository(Attendance)
    private readonly repository: Repository<Attendance>,
  ) {}

  findAll(): Promise<Attendance[]> {
    return this.repository.find();
  }
}
