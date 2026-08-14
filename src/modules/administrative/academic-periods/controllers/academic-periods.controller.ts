import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AcademicPeriodsService } from '../services/academic-periods.service';

@ApiTags('Administrative - AcademicPeriods')
@ApiBearerAuth()
@Controller('academic-periods')
export class AcademicPeriodsController {
  constructor(private readonly service: AcademicPeriodsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar academic-periods (stub)' })
  findAll() {
    return this.service.findAll();
  }
}
