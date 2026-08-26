import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { CreateGuideTeacherDto } from '../dto/create-guide-teacher.dto';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateGuideTeacherDto } from '../dto/update-guide-teacher.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UsersService } from '../services/users.service';

@ApiTags('Administrative - Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Post('guide-teachers')
  @ApiOperation({ summary: 'Crear docente guía' })
  createGuideTeacher(@Body() dto: CreateGuideTeacherDto) {
    return this.service.createGuideTeacher(dto);
  }

  @Get('guide-teachers')
  @ApiOperation({ summary: 'Listar docentes guía disponibles' })
  findGuideTeachers() {
    return this.service.findGuideTeachers();
  }

  @Patch('guide-teachers/:id')
  @ApiOperation({ summary: 'Editar docente guía' })
  updateGuideTeacher(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGuideTeacherDto,
    @CurrentUser() actor?: AuthenticatedUser,
  ) {
    return this.service.updateGuideTeacher(id, dto, actor?.id);
  }

  @Delete('guide-teachers/:id')
  @ApiOperation({ summary: 'Inactivar docente guía y quitar asignaciones' })
  removeGuideTeacher(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor?: AuthenticatedUser,
  ) {
    return this.service.removeGuideTeacher(id, actor?.id);
  }

  @Post()
  @ApiOperation({ summary: 'Registro manual de usuario (WF-17)' })
  create(@Body() dto: CreateUserDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar usuarios' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar usuario (WF-18)' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar usuario y registrar auditoría (WF-18)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor?: AuthenticatedUser,
  ) {
    return this.service.update(id, dto, actor?.id);
  }
}
