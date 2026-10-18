import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../../../common/constants/permissions.constant';
import { DepartmentsService } from '../services/departments.service';

@ApiTags('Departments')
@ApiBearerAuth()
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @Permissions(PERMISSIONS.ADMINISTRATOR_VIEW)
  @ApiOperation({ summary: 'Listar departamentos académicos activos' })
  list() {
    return this.departmentsService.listActive();
  }
}
