import { Injectable, NotImplementedException } from '@nestjs/common';
import { RolesRepository } from '../repositories/roles.repository';

@Injectable()
export class RolesService {
  constructor(private readonly repository: RolesRepository) {}

  findAll() {
    throw new NotImplementedException('Roles listado pendiente de implementar');
  }
}
