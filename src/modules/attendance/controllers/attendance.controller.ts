import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { CreateAttendanceSessionDto } from '../dto/create-attendance-session.dto';
import { CreateAttendanceSessionFromScheduleDto } from '../dto/create-attendance-session-from-schedule.dto';
import { UpsertAttendanceRecordsDto } from '../dto/upsert-attendance-records.dto';
import { AttendanceRecordsService } from '../services/attendance-records.service';
import { AttendanceSessionsService } from '../services/attendance-sessions.service';

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
  ) {}

  /** PermissionsGuard requires ALL listed codes — one permission per handler. */

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

  @Post('sessions/from-schedule')
  @Permissions(PERMISSIONS.ATTENDANCE_REGISTER)
  createSessionFromSchedule(
    @Body() dto: CreateAttendanceSessionFromScheduleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.sessions.createSessionFromSchedule(dto, actor);
  }

  @Post('sessions')
  @Permissions(PERMISSIONS.ATTENDANCE_REGISTER)
  createSession(
    @Body() dto: CreateAttendanceSessionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.sessions.createSession(dto, actor);
  }

  @Get('sessions/:id')
  @Permissions(PERMISSIONS.ATTENDANCE_READ)
  getSessionDetail(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.sessions.getSessionDetail(id, actor);
  }

  @Post('sessions/:id/close')
  @Permissions(PERMISSIONS.ATTENDANCE_EDIT)
  closeSession(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
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

  @Put('sessions/:sessionId/records')
  @Permissions(PERMISSIONS.ATTENDANCE_EDIT)
  upsertRecords(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Body() dto: UpsertAttendanceRecordsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.records.upsertRecords(sessionId, dto, actor);
  }
}
