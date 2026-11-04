import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { CreateNonWorkingDayDto, UpdateDisciplinarySettingsDto } from '../dto/disciplinary-calendar.dto';
import { DisciplinaryCalendarService } from '../services/disciplinary-calendar.service';

@ApiTags('Disciplinary - Calendario')
@ApiBearerAuth()
@Controller('disciplinary')
export class DisciplinaryCalendarController {
  constructor(private readonly calendar: DisciplinaryCalendarService) {}

  @Get('non-working-days')
  @Permissions(PERMISSIONS.DISCIPLINARY_CONFIGURE)
  @ApiOperation({ summary: 'Listar días no hábiles institucionales' })
  listDays() {
    return this.calendar.listDays();
  }

  @Post('non-working-days')
  @Permissions(PERMISSIONS.DISCIPLINARY_CONFIGURE)
  @ApiOperation({ summary: 'Registrar un día no hábil' })
  createDay(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateNonWorkingDayDto) {
    return this.calendar.createDay(actor, dto);
  }

  @Delete('non-working-days/:id')
  @Permissions(PERMISSIONS.DISCIPLINARY_CONFIGURE)
  @ApiOperation({ summary: 'Eliminar un día no hábil' })
  deleteDay(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    return this.calendar.deleteDay(actor, id);
  }

  @Get('settings')
  @Permissions(PERMISSIONS.DISCIPLINARY_CONFIGURE)
  @ApiOperation({ summary: 'Umbrales de reincidencia y nota de conducta' })
  getSettings() {
    return this.calendar.getSettings();
  }

  @Put('settings')
  @Permissions(PERMISSIONS.DISCIPLINARY_CONFIGURE)
  @ApiOperation({ summary: 'Actualizar umbrales de alerta' })
  updateSettings(@CurrentUser() actor: AuthenticatedUser, @Body() dto: UpdateDisciplinarySettingsDto) {
    return this.calendar.updateSettings(actor, dto);
  }
}
