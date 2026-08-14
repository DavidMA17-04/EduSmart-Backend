import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PermissionEntity } from '../entities/permission.entity';

@Injectable()
export class PermissionsRepository {
  constructor(
    @InjectRepository(PermissionEntity)
    private readonly repository: Repository<PermissionEntity>,
  ) {}

  async findAll(): Promise<PermissionEntity[]> {
    return this.repository.find();
  }
}
