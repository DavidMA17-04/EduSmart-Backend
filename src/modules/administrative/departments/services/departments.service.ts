import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from '../entities/department.entity';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department)
    private readonly departments: Repository<Department>,
  ) {}

  listActive(): Promise<Department[]> {
    return this.departments.find({
      where: { status: 'ACTIVE' },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async getByIdOrFail(id: number): Promise<Department> {
    const department = await this.departments.findOne({ where: { id } });
    if (!department || department.status !== 'ACTIVE') {
      throw new NotFoundException(`Departamento ${id} no encontrado`);
    }
    return department;
  }
}
