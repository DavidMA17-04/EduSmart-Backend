import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { CreateScheduledPermitDto, ScheduledPermitFilterDto } from '../dto/scheduled-permit.dto';
import { ScheduledPermitsService } from '../services/scheduled-permits.service';

@ApiTags('Scheduled departure permits')
@ApiBearerAuth()
@Controller('scheduled-permits')
export class ScheduledPermitsController {
  constructor(private readonly permits: ScheduledPermitsService) {}

  @Get('today')
  @Permissions(PERMISSIONS.DEPARTURES_VIEW_HISTORY)
  @ApiOperation({ summary: 'Permisos pendientes para hoy' })
  today() {
    return this.permits.today();
  }

  @Get()
  @Permissions(PERMISSIONS.DEPARTURES_VIEW_HISTORY)
  @ApiOperation({ summary: 'Permisos de una fecha (por defecto hoy)' })
  list(@Query() filter: ScheduledPermitFilterDto) {
    return this.permits.list(filter);
  }

  @Post()
  @Permissions(PERMISSIONS.DEPARTURES_MANAGE_PERMITS)
  @ApiOperation({ summary: 'Programar un permiso de salida' })
  create(@Body() dto: CreateScheduledPermitDto, @CurrentUser() user: AuthenticatedUser) {
    return this.permits.create(dto, user);
  }

  @Patch(':id/complete')
  @Permissions(PERMISSIONS.DEPARTURES_CREATE)
  @ApiOperation({ summary: 'Marcar un permiso como completado' })
  complete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.permits.complete(id);
  }
}
