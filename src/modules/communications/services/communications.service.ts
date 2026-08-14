import { Injectable, NotImplementedException } from '@nestjs/common';
import { CommunicationsRepository } from '../repositories/communications.repository';
import { CreateCommunicationDto } from '../dto/create-communication.dto';
import { UpdateCommunicationDto } from '../dto/update-communication.dto';
import { CommunicationFilterDto } from '../dto/communication-filter.dto';

@Injectable()
export class CommunicationsService {
  constructor(private readonly communicationsRepository: CommunicationsRepository) {}

  create(_dto: CreateCommunicationDto) {
    throw new NotImplementedException('Creación de comunicado pendiente');
  }

  findAll(_filter: CommunicationFilterDto) {
    throw new NotImplementedException('Listado de comunicados pendiente');
  }

  update(_id: string, _dto: UpdateCommunicationDto) {
    throw new NotImplementedException('Actualización de comunicado pendiente');
  }
}
