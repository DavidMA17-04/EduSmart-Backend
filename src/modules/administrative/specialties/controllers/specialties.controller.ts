import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SpecialtiesService } from '../services/specialties.service';

@ApiTags('Administrative - Specialties')
@ApiBearerAuth()
@Controller('specialties')
export class SpecialtiesController {
  constructor(private readonly service: SpecialtiesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar specialties (stub)' })
  findAll() {
    return this.service.findAll();
  }
}
