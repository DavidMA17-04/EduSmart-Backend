import { Injectable, NotImplementedException } from '@nestjs/common';
import { DisciplinaryRepository } from '../repositories/disciplinary.repository';
import { CreateDisciplinaryActionDto } from '../dto/create-disciplinary-action.dto';
import { UpdateDisciplinaryActionDto } from '../dto/update-disciplinary-action.dto';
import { DisciplinaryFilterDto } from '../dto/disciplinary-filter.dto';

@Injectable()
export class DisciplinaryService {
  constructor(private readonly disciplinaryRepository: DisciplinaryRepository) {}

  create(_dto: CreateDisciplinaryActionDto) {
    throw new NotImplementedException('Registro disciplinario pendiente');
  }

  findAll(_filter: DisciplinaryFilterDto) {
    throw new NotImplementedException('Consulta disciplinaria pendiente');
  }

  findOne(_id: string) {
    throw new NotImplementedException('Detalle disciplinario pendiente');
  }

  update(_id: string, _dto: UpdateDisciplinaryActionDto) {
    throw new NotImplementedException('Actualización disciplinaria pendiente');
  }
}
