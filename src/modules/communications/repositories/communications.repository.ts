import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Communication } from '../entities/communication.entity';

@Injectable()
export class CommunicationsRepository {
  constructor(
    @InjectRepository(Communication)
    private readonly repository: Repository<Communication>,
  ) {}

  findAll(): Promise<Communication[]> {
    return this.repository.find();
  }
}
