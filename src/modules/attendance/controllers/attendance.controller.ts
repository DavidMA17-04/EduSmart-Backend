import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { AttendanceHistoryFilterDto } from '../dto/attendance-history-filter.dto';
import { CreateAttendanceSessionDto } from '../dto/create-attendance-session.dto';
import { CreateAttendanceSessionFromScheduleDto } from '../dto/create-attendance-session-from-schedule.dto';
import { RedeemAttendanceTokenDto } from '../dto/redeem-attendance-token.dto';
import { UpsertAttendanceRecordsDto } from '../dto/upsert-attendance-records.dto';
import { AttendanceExportService } from '../services/attendance-export.service';
import { AttendanceHistoryService } from '../services/attendance-history.service';
import { AttendanceRecordsService } from '../services/attendance-records.service';
import { AttendanceSessionsService } from '../services/attendance-sessions.service';
import { AttendanceTokenService } from '../services/attendance-token.service';

class AttendanceScheduleContextQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  periodId?: number;
}

@ApiTags('attendance')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly sessions: AttendanceSessionsService,
    private readonly records: AttendanceRecordsService,
    private readonly history: AttendanceHistoryService,
    private readonly tokens: AttendanceTokenService,
    private readonly exports: AttendanceExportService,
  ) {}

  /** PermissionsGuard requires ALL listed codes — one permission per handler. */

  @Get('history')
  @Permissions(PERMISSIONS.ATTENDANCE_READ)
  searchHistory(
    @Query() query: AttendanceHistoryFilterDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.history.search(query, actor);
  }

  @Get('groups')
  @Permissions(PERMISSIONS.ATTENDANCE_READ)
  listAttendanceGroups(@CurrentUser() actor: AuthenticatedUser) {
    return this.sessions.listAttendanceGroups(actor);
  }

  @Get('groups/:groupId/available-offerings')
  @Permissions(PERMISSIONS.ATTENDANCE_READ)
  listAvailableOfferings(
    @Param('groupId', ParseIntPipe) groupId: number,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.sessions.listAvailableOfferings(groupId, actor);
  }

  @Get('schedule-context')
  @Permissions(PERMISSIONS.ATTENDANCE_READ)
  getScheduleContext(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: AttendanceScheduleContextQueryDto,
  ) {
    return this.sessions.getScheduleContext(actor, {
      periodId: query.periodId,
    });
  }

  @Post('redeem-token')
  redeemTokenAlias(
    @Body() dto: RedeemAttendanceTokenDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.tokens.redeemToken(dto, actor);
  }

  @Post('sessions/from-schedule')
  @Permissions(PERMISSIONS.ATTENDANCE_REGISTER)
  createSessionFromSchedule(
    @Body() dto: CreateAttendanceSessionFromScheduleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.sessions.createSessionFromSchedule(dto, actor);
  }

  @Post('sessions/redeem-token')
  redeemToken(
    @Body() dto: RedeemAttendanceTokenDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.tokens.redeemToken(dto, actor);
  }

  @Post('sessions')
  @Permissions(PERMISSIONS.ATTENDANCE_REGISTER)
  createSession(@Body() dto: CreateAttendanceSessionDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.sessions.createSession(dto, actor);
  }

  @Get('sessions/:id')
  @Permissions(PERMISSIONS.ATTENDANCE_READ)
  getSessionDetail(@Param('id', ParseIntPipe) id: number, @CurrentUser() actor: AuthenticatedUser) {
    return this.sessions.getSessionDetail(id, actor);
  }

  @Post('sessions/:id/token')
  @Permissions(PERMISSIONS.ATTENDANCE_EDIT)
  generateSessionToken(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.tokens.generateToken(id, actor);
  }

  @Post('sessions/:id/close')
  @Permissions(PERMISSIONS.ATTENDANCE_EDIT)
  closeSession(@Param('id', ParseIntPipe) id: number, @CurrentUser() actor: AuthenticatedUser) {
    return this.sessions.closeSession(id, actor);
  }

  @Get('sessions/:sessionId/roster')
  @Permissions(PERMISSIONS.ATTENDANCE_READ)
  getRoster(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.records.getRoster(sessionId, actor);
  }

  /** Alias: lista de estudiantes matriculados + estado de asistencia. */
  @Get('sessions/:sessionId/students')
  @Permissions(PERMISSIONS.ATTENDANCE_READ)
  getStudents(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.records.getRoster(sessionId, actor);
  }

  @Put('sessions/:sessionId/records')
  @Permissions(PERMISSIONS.ATTENDANCE_EDIT)
  upsertRecords(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Body() dto: UpsertAttendanceRecordsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.records.upsertRecords(sessionId, dto, actor);
  }

  /** Alias de guardado masivo (mismo contrato que PUT .../records). */
  @Post('sessions/:sessionId/save-records')
  @Permissions(PERMISSIONS.ATTENDANCE_EDIT)
  saveRecords(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Body() dto: UpsertAttendanceRecordsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.records.upsertRecords(sessionId, dto, actor);
  }

  @Get('sessions/:sessionId/export/pdf')
  @Permissions(PERMISSIONS.ATTENDANCE_READ)
  @Header('Content-Type', 'application/pdf')
  @Header(
    'Content-Disposition',
    'attachment; filename="reporte-asistencia.pdf"',
  )
  @ApiProduces('application/pdf')
  async exportPdf(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<StreamableFile> {
    const buffer = await this.exports.exportPdf(sessionId, actor);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: 'attachment; filename="reporte-asistencia.pdf"',
    });
  }

  @Get('sessions/:sessionId/export/excel')
  @Permissions(PERMISSIONS.ATTENDANCE_READ)
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Header(
    'Content-Disposition',
    'attachment; filename="reporte-asistencia.xlsx"',
  )
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  async exportExcel(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<StreamableFile> {
    const buffer = await this.exports.exportExcel(sessionId, actor);
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="reporte-asistencia.xlsx"',
    });
  }
}
