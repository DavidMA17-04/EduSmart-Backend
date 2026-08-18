import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from '../services/users.service';

@ApiTags('Administrative - Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get('guide-teachers')
  @ApiOperation({ summary: 'Listar docentes guía disponibles' })
  findGuideTeachers() {
    return this.service.findGuideTeachers();
  }

  @Get()
  @ApiOperation({ summary: 'Listar usuarios' })
  findAll() {
    return this.service.findAll();
  }
}
