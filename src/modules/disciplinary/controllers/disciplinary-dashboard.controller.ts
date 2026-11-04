import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { DisciplinaryDashboardQueryDto } from '../dto/disciplinary-dashboard-query.dto';
import { DisciplinaryDashboardService } from '../services/disciplinary-dashboard.service';

@ApiTags('Disciplinary - Tablero')
@ApiBearerAuth()
@Controller('disciplinary')
export class DisciplinaryDashboardController {
  constructor(private readonly dashboard: DisciplinaryDashboardService) {}

  @Get('dashboard')
  @ApiOperation({
    summary: 'Totales, plazos, alertas y estudiantes con más expedientes. El guía solo ve sus secciones.',
  })
  get(@CurrentUser() actor: AuthenticatedUser, @Query() query: DisciplinaryDashboardQueryDto) {
    return this.dashboard.get(actor, query);
  }
}
