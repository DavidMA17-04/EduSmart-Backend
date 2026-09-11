import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { MyScheduleQueryDto } from '../dto/my-schedule-query.dto';
import { ScheduleEntriesService } from '../services/schedule-entries.service';

@ApiTags('Schedule - My Schedule')
@ApiBearerAuth()
@Controller('schedule')
export class ScheduleMyScheduleController {
  constructor(private readonly entries: ScheduleEntriesService) {}

  @Get('my-schedule')
  @Permissions(PERMISSIONS.SCHEDULES_VIEW_OWN)
  @ApiOperation({
    summary:
      'Horario propio del actor (Docente por TA; Estudiante por GroupEnrollment)',
  })
  getMySchedule(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: MyScheduleQueryDto,
  ) {
    return this.entries.getMySchedule(
      { id: actor.id, roles: actor.roles ?? [] },
      {
        periodId: query.periodId,
        dayOfWeek: query.dayOfWeek,
      },
    );
  }
}
