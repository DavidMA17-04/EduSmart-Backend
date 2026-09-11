import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { CreateScheduleTimeSlotDto } from '../dto/create-schedule-time-slot.dto';
import { UpdateScheduleTimeSlotDto } from '../dto/update-schedule-time-slot.dto';
import { ScheduleTimeSlotsService } from '../services/schedule-time-slots.service';

@ApiTags('Schedule - Time Slots')
@ApiBearerAuth()
@Controller('schedule/time-slots')
export class ScheduleTimeSlotsController {
  constructor(private readonly service: ScheduleTimeSlotsService) {}

  @Get()
  @Permissions(PERMISSIONS.SCHEDULES_VIEW)
  @ApiOperation({ summary: 'Listar bloques horarios (activos e inactivos)' })
  list() {
    return this.service.list();
  }

  @Get(':id')
  @Permissions(PERMISSIONS.SCHEDULES_VIEW)
  @ApiOperation({ summary: 'Obtener bloque horario' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @Permissions(PERMISSIONS.SCHEDULES_EDIT)
  @ApiOperation({ summary: 'Crear bloque horario' })
  create(@Body() dto: CreateScheduleTimeSlotDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @Permissions(PERMISSIONS.SCHEDULES_EDIT)
  @ApiOperation({ summary: 'Actualizar bloque horario' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateScheduleTimeSlotDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.SCHEDULES_EDIT)
  @ApiOperation({
    summary:
      'Eliminar bloque si no está referenciado; si está en uso, preferir is_active=false',
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
