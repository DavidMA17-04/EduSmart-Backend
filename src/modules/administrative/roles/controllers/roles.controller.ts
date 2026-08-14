import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesService } from '../services/roles.service';

@ApiTags('Administrative - Roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly service: RolesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar roles (stub)' })
  findAll() {
    return this.service.findAll();
  }
}
