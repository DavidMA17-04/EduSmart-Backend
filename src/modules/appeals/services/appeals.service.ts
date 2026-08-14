import { Injectable, NotImplementedException } from '@nestjs/common';
import { AppealsRepository } from '../repositories/appeals.repository';
import { CreateAppealDto } from '../dto/create-appeal.dto';
import { ReviewAppealDto } from '../dto/review-appeal.dto';
import { AppealFilterDto } from '../dto/appeal-filter.dto';

@Injectable()
export class AppealsService {
  constructor(private readonly appealsRepository: AppealsRepository) {}

  create(_dto: CreateAppealDto) {
    throw new NotImplementedException('Registro de apelación pendiente');
  }

  findAll(_filter: AppealFilterDto) {
    throw new NotImplementedException('Listado de apelaciones pendiente');
  }

  findOne(_id: string) {
    throw new NotImplementedException('Detalle de apelación pendiente');
  }

  review(_id: string, _dto: ReviewAppealDto) {
    throw new NotImplementedException('Revisión de apelación pendiente');
  }
}
