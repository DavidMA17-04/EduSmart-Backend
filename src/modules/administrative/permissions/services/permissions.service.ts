import { Injectable, NotImplementedException } from '@nestjs/common';
import { PermissionsRepository } from '../repositories/permissions.repository';

@Injectable()
export class PermissionsService {
  constructor(private readonly repository: PermissionsRepository) {}

  findAll() {
    throw new NotImplementedException('Permissions listado pendiente de implementar');
  }
}
