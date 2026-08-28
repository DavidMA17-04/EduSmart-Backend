import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AcademicPeriodReportFilterDto } from '../dto/academic-period-report-filter.dto';
import { AcademicStructureReportFilterDto } from '../dto/academic-structure-report-filter.dto';
import { UserReportFilterDto } from '../dto/user-report-filter.dto';
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
  getUsersReport(
    @Query() filters: UserReportFilterDto,
  ): Promise<UserReportItem[]> {
    return this.service.getUsersReport(filters);
  }

  @Get('academic-structure')
  @ApiOperation({ summary: 'Reporte de estructura académica (grupos y secciones)' })
  getAcademicStructureReport(
    @Query() filters: AcademicStructureReportFilterDto,
  ): Promise<AcademicStructureReportItem[]> {
    return this.service.getAcademicStructureReport(filters);
  }

  @Get('academic-periods')
  @ApiOperation({ summary: 'Reporte de períodos académicos' })
  getAcademicPeriodsReport(
    @Query() filters: AcademicPeriodReportFilterDto,
  ): Promise<AcademicPeriodReportItem[]> {
    return this.service.getAcademicPeriodsReport(filters);
  }
}
