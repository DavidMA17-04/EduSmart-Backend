import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../../../common/constants/permissions.constant';
import { CreateGroupEnrollmentDto } from '../dto/create-group-enrollment.dto';
import { GroupEnrollmentAsOfQueryDto } from '../dto/group-enrollment-as-of-query.dto';
import { TransferGroupEnrollmentDto } from '../dto/transfer-group-enrollment.dto';
import { GroupEnrollmentsService } from '../services/group-enrollments.service';

@ApiTags('Administrative - Group Enrollments')
@ApiBearerAuth()
@Controller('group-enrollments')
export class GroupEnrollmentsController {
  constructor(private readonly service: GroupEnrollmentsService) {}

  @Post()
  @Permissions(PERMISSIONS.STUDENTS_CREATE)
  @ApiOperation({ summary: 'Crear matrícula histórica estudiante→grupo' })
  create(@Body() dto: CreateGroupEnrollmentDto) {
    return this.service.create(dto);
  }

  @Post('transfer')
  @Permissions(PERMISSIONS.STUDENTS_UPDATE)
  @ApiOperation({
    summary: 'Cambiar de grupo: cierra matrícula anterior y abre una nueva',
  })
  transfer(@Body() dto: TransferGroupEnrollmentDto) {
    return this.service.transfer(dto);
  }

  @Get('as-of')
  @Permissions(PERMISSIONS.STUDENTS_READ)
  @ApiOperation({ summary: 'Grupo del estudiante en una fecha (as-of)' })
  findAsOf(@Query() query: GroupEnrollmentAsOfQueryDto) {
    return this.service.findGroupAsOf(
      query.userId,
      query.date,
      query.academicPeriodId,
    );
  }
}
