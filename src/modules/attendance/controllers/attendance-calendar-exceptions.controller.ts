import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { CreateAttendanceCalendarExceptionDto } from '../dto/create-attendance-calendar-exception.dto';
import { ListAttendanceCalendarExceptionsQueryDto } from '../dto/list-attendance-calendar-exceptions-query.dto';
import { UpdateAttendanceCalendarExceptionDto } from '../dto/update-attendance-calendar-exception.dto';
import { AttendanceCalendarExceptionsService } from '../services/attendance-calendar-exceptions.service';

@ApiTags('Attendance Calendar Exceptions')
@ApiBearerAuth()
@Controller('attendance/exceptions')
export class AttendanceCalendarExceptionsController {
  constructor(
    private readonly exceptionsService: AttendanceCalendarExceptionsService,
  ) {}

  @Post()
  @Permissions(PERMISSIONS.ATTENDANCE_EDIT)
  @ApiOperation({ summary: 'Registrar excepción de calendario (semana de exámenes)' })
  create(
    @Body() dto: CreateAttendanceCalendarExceptionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.exceptionsService.create(dto, actor);
  }

  @Get()
  @Permissions(PERMISSIONS.ATTENDANCE_READ)
  @ApiOperation({ summary: 'Listar excepciones de calendario' })
  list(@Query() query: ListAttendanceCalendarExceptionsQueryDto) {
    return this.exceptionsService.list(query);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.ATTENDANCE_READ)
  @ApiOperation({ summary: 'Detalle de excepción de calendario' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.exceptionsService.findOne(id);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.ATTENDANCE_EDIT)
  @ApiOperation({ summary: 'Actualizar excepción de calendario' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAttendanceCalendarExceptionDto,
  ) {
    return this.exceptionsService.update(id, dto);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.ATTENDANCE_EDIT)
  @ApiOperation({ summary: 'Eliminar excepción de calendario' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.exceptionsService.remove(id);
  }
}
