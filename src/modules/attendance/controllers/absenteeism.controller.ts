import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AbsenteeismRiskLevel } from '../../../common/enums/absenteeism-risk-level.enum';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { AbsenteeismService } from '../services/absenteeism.service';

class AbsenteeismStudentsQueryDto {
  @IsOptional()
  @IsEnum(AbsenteeismRiskLevel)
  risk?: AbsenteeismRiskLevel;
}

class UpdateAbsenteeismRuleDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  thresholdValue?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@ApiTags('attendance-absenteeism')
@ApiBearerAuth()
@Controller('attendance/absenteeism')
export class AbsenteeismController {
  constructor(private readonly absenteeism: AbsenteeismService) {}

  @Get('dashboard')
  @Permissions(PERMISSIONS.ATTENDANCE_READ)
  getDashboard(@CurrentUser() actor: AuthenticatedUser) {
    return this.absenteeism.getDashboard(actor);
  }

  @Get('students')
  @Permissions(PERMISSIONS.ATTENDANCE_READ)
  listStudents(
    @Query() query: AbsenteeismStudentsQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.absenteeism.listStudents(actor, query.risk);
  }

  @Get('alerts')
  @Permissions(PERMISSIONS.ATTENDANCE_READ)
  listAlerts(@CurrentUser() actor: AuthenticatedUser) {
    return this.absenteeism.listAlerts(actor);
  }

  @Get('rules')
  @Permissions(PERMISSIONS.ATTENDANCE_READ)
  listRules(@CurrentUser() actor: AuthenticatedUser) {
    return this.absenteeism.listRules(actor);
  }

  @Patch('rules/:id')
  @Permissions(PERMISSIONS.ATTENDANCE_EDIT)
  updateRule(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAbsenteeismRuleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.absenteeism.updateRule(actor, id, dto);
  }

  @Post('notifications/:id/read')
  @Permissions(PERMISSIONS.ATTENDANCE_READ)
  markRead(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.absenteeism.markNotificationRead(actor, id);
  }
}
