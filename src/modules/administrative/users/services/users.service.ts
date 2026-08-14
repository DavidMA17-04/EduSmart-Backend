import { Injectable, NotImplementedException } from '@nestjs/common';
import { UsersRepository } from '../repositories/users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly repository: UsersRepository) {}

  findAll() {
    throw new NotImplementedException('Users listado pendiente de implementar');
  }
}
