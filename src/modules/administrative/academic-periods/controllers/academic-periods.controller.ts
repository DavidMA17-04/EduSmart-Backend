import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../../../common/constants/permissions.constant';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { actorSeesFullAcademicHistory } from '../../shared/academic-visibility.util';
import { CreateAcademicPeriodDto } from '../dto/create-academic-period.dto';
import { UpdateAcademicPeriodDto } from '../dto/update-academic-period.dto';
import { AcademicPeriodsService } from '../services/academic-periods.service';

@ApiTags('Administrative - AcademicPeriods')
@ApiBearerAuth()
@Controller('academic-periods')
export class AcademicPeriodsController {
  constructor(private readonly service: AcademicPeriodsService) {}

  @Post()
  @Permissions(PERMISSIONS.PERIODS_CREATE)
  @ApiOperation({ summary: 'Crear curso lectivo' })
  create(@Body() dto: CreateAcademicPeriodDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({
    summary:
      'Listar cursos lectivos (Admin/Director: historial; resto: año activo)',
  })
  findAll(@CurrentUser() actor: AuthenticatedUser) {
    if (actorSeesFullAcademicHistory(actor?.roles ?? [])) {
      return this.service.findAll();
    }
    return this.service.findVisibleForTeacher();
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.PERIODS_EDIT)
  @ApiOperation({ summary: 'Editar curso lectivo' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAcademicPeriodDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/close')
  @Permissions(PERMISSIONS.PERIODS_EDIT)
  @ApiOperation({ summary: 'Cerrar curso lectivo' })
  close(@Param('id', ParseIntPipe) id: number) {
    return this.service.close(id);
  }

  @Patch(':id/activate')
  @Permissions(PERMISSIONS.PERIODS_EDIT)
  @ApiOperation({ summary: 'Activar curso lectivo' })
  activate(@Param('id', ParseIntPipe) id: number) {
    return this.service.activate(id);
  }

  @Patch(':id/reopen')
  @Permissions(PERMISSIONS.PERIODS_EDIT)
  @ApiOperation({ summary: 'Reabrir curso lectivo' })
  reopen(@Param('id', ParseIntPipe) id: number) {
    return this.service.reopen(id);
  }
}
