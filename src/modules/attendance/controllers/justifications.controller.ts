import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JustificationsService } from '../services/justifications.service';
import { JustifyAbsenceDto } from '../dto/justify-absence.dto';

@ApiTags('Attendance Justifications')
@ApiBearerAuth()
@Controller('attendance/justifications')
export class JustificationsController {
  constructor(private readonly justificationsService: JustificationsService) {}

  @Post()
  @ApiOperation({ summary: 'Justificar ausencia (stub)' })
  justify(@Body() dto: JustifyAbsenceDto) {
    return this.justificationsService.justify(dto);
  }
}
