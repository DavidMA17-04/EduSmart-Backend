import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AttendanceService } from '../services/attendance.service';
import { AbsencesService } from '../services/absences.service';
import { RegisterAttendanceDto } from '../dto/register-attendance.dto';
import { RegisterAbsenceDto } from '../dto/register-absence.dto';
import { AttendanceFilterDto } from '../dto/attendance-filter.dto';

@ApiTags('Attendance')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly absencesService: AbsencesService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Registrar asistencia (stub)' })
  register(@Body() dto: RegisterAttendanceDto) {
    return this.attendanceService.register(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Consultar asistencia (stub)' })
  findAll(@Query() filter: AttendanceFilterDto) {
    return this.attendanceService.findAll(filter);
  }

  @Post('absences')
  @ApiOperation({ summary: 'Registrar ausencia (stub)' })
  registerAbsence(@Body() dto: RegisterAbsenceDto) {
    return this.absencesService.register(dto);
  }
}
