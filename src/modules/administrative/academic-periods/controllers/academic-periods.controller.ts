import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateAcademicPeriodDto } from '../dto/create-academic-period.dto';
import { AcademicPeriodsService } from '../services/academic-periods.service';

@ApiTags('Administrative - AcademicPeriods')
@ApiBearerAuth()
@Controller('academic-periods')
export class AcademicPeriodsController {
  constructor(private readonly service: AcademicPeriodsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear período académico' })
  create(@Body() dto: CreateAcademicPeriodDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar academic-periods (stub)' })
  findAll() {
    return this.service.findAll();
  }
}
