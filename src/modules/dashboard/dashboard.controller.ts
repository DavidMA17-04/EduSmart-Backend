import { Controller, Get } from '@nestjs/common';
import { PERMISSIONS } from '../../common/constants/permissions.constant';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { DashboardService } from './dashboard.service';
import { DashboardSummaryDto } from './dto/dashboard-summary.dto';

@Controller('dashboard')
@Permissions(PERMISSIONS.ADMINISTRATOR_VIEW)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  getSummary(): Promise<DashboardSummaryDto> {
    return this.dashboardService.getSummary();
  }
}
