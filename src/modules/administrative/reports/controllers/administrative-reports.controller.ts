import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AcademicPeriodReportItem,
  AcademicStructureReportItem,
  UserReportItem,
} from '../interfaces/administrative-report.interface';
import { AdministrativeReportsService } from '../services/administrative-reports.service';

@ApiTags('Administrative - Reports')
@ApiBearerAuth()
@Controller('administrative-reports')
export class AdministrativeReportsController {
  constructor(private readonly service: AdministrativeReportsService) {}

  @Get('users')
  @ApiOperation({ summary: 'Reporte de usuarios administrativos' })
  getUsersReport(): Promise<UserReportItem[]> {
    return this.service.getUsersReport();
  }

  @Get('academic-structure')
  @ApiOperation({ summary: 'Reporte de estructura académica (grupos y secciones)' })
  getAcademicStructureReport(): Promise<AcademicStructureReportItem[]> {
    return this.service.getAcademicStructureReport();
  }

  @Get('academic-periods')
  @ApiOperation({ summary: 'Reporte de períodos académicos' })
  getAcademicPeriodsReport(): Promise<AcademicPeriodReportItem[]> {
    return this.service.getAcademicPeriodsReport();
  }
}
