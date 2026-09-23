import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { actorSeesFullAcademicHistory } from '../../shared/academic-visibility.util';
import { CreateAcademicYearDto } from '../dto/create-academic-year.dto';
import { UpdateAcademicYearDto } from '../dto/update-academic-year.dto';
import { AcademicYearsService } from '../services/academic-years.service';

@ApiTags('Administrative - AcademicYears')
@ApiBearerAuth()
@Controller('academic-years')
export class AcademicYearsController {
  constructor(private readonly service: AcademicYearsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear año lectivo' })
  create(@Body() dto: CreateAcademicYearDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar años lectivos (docente: solo activo; admin: historial completo)',
  })
  async findAll(@CurrentUser() actor: AuthenticatedUser) {
    if (actorSeesFullAcademicHistory(actor?.roles ?? [])) {
      return this.service.findAll();
    }
    const active = await this.service.findActive();
    return active ? [active] : [];
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener año lectivo' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar año lectivo' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAcademicYearDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activar año lectivo (único activo)' })
  activate(@Param('id', ParseIntPipe) id: number) {
    return this.service.activate(id);
  }

  @Patch(':id/close')
  @ApiOperation({ summary: 'Cerrar año lectivo' })
  close(@Param('id', ParseIntPipe) id: number) {
    return this.service.close(id);
  }
}
