import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateAcademicPeriodDto } from '../dto/create-academic-period.dto';
import { UpdateAcademicPeriodDto } from '../dto/update-academic-period.dto';
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

  @Patch(':id')
  @ApiOperation({ summary: 'Editar período académico' })
  update(@Param('id') id: string, @Body() dto: UpdateAcademicPeriodDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/close')
  @ApiOperation({ summary: 'Cerrar período académico' })
  close(@Param('id') id: string) {
    return this.service.close(id);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activar período académico' })
  activate(@Param('id') id: string) {
    return this.service.activate(id);
  }

  @Patch(':id/reopen')
  @ApiOperation({ summary: 'Reabrir período académico' })
  reopen(@Param('id') id: string) {
    return this.service.reopen(id);
  }
}
