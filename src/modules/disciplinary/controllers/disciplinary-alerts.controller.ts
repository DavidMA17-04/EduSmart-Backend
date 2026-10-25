import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { DisciplinaryAlertsService } from '../services/disciplinary-alerts.service';

@ApiTags('Disciplinary - Alertas')
@ApiBearerAuth()
@Controller('disciplinary')
export class DisciplinaryAlertsController {
  constructor(private readonly alerts: DisciplinaryAlertsService) {}

  @Get('alerts')
  @ApiOperation({
    summary:
      'Alertas de reincidencia, nota baja, plazos, lectura sin confirmar, sección sin guía y año sin días no hábiles',
  })
  list(@CurrentUser() actor: AuthenticatedUser) {
    return this.alerts.list(actor);
  }
}
