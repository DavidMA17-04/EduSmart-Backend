import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { CreateScheduleEntryDto } from '../dto/create-schedule-entry.dto';
import { UpdateScheduleEntryDto } from '../dto/update-schedule-entry.dto';
import { ScheduleEntriesService } from '../services/schedule-entries.service';

function optionalPositiveInt(
  raw: string | undefined,
  field: string,
): number | undefined {
  if (raw == null || raw === '') return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new BadRequestException(`${field} must be a positive integer`);
  }
  return value;
}

function optionalDayOfWeek(raw: string | undefined): number | undefined {
  if (raw == null || raw === '') return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new BadRequestException('dayOfWeek must be an integer between 1 and 5');
  }
  return value;
}

@ApiTags('Schedule - Entries')
@ApiBearerAuth()
@Controller('schedule/entries')
export class ScheduleEntriesController {
  constructor(private readonly service: ScheduleEntriesService) {}

  @Get()
  @Permissions(PERMISSIONS.SCHEDULES_VIEW)
  @ApiOperation({
    summary:
      'Listar entradas de horario (filtros: teacherId, groupId, periodId, dayOfWeek)',
  })
  list(
    @Query('teacherId') teacherId?: string,
    @Query('groupId') groupId?: string,
    @Query('periodId') periodId?: string,
    @Query('dayOfWeek') dayOfWeek?: string,
  ) {
    return this.service.list({
      teacherId: optionalPositiveInt(teacherId, 'teacherId'),
      groupId: optionalPositiveInt(groupId, 'groupId'),
      periodId: optionalPositiveInt(periodId, 'periodId'),
      dayOfWeek: optionalDayOfWeek(dayOfWeek),
    });
  }

  @Get(':id')
  @Permissions(PERMISSIONS.SCHEDULES_VIEW)
  @ApiOperation({ summary: 'Obtener entrada de horario' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @Permissions(PERMISSIONS.SCHEDULES_EDIT)
  @ApiOperation({ summary: 'Crear entrada de horario' })
  create(@Body() dto: CreateScheduleEntryDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @Permissions(PERMISSIONS.SCHEDULES_EDIT)
  @ApiOperation({ summary: 'Actualizar entrada de horario' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateScheduleEntryDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.SCHEDULES_EDIT)
  @ApiOperation({ summary: 'Eliminar entrada de horario' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
