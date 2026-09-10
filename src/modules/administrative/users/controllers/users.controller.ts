import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../../../common/constants/permissions.constant';
import { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { CreateGuideTeacherDto } from '../dto/create-guide-teacher.dto';
import { CreateUserDto } from '../dto/create-user.dto';
import { ListUsersQueryDto } from '../dto/list-users-query.dto';
import { UpdateGuideTeacherDto } from '../dto/update-guide-teacher.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UsersService } from '../services/users.service';

@ApiTags('Administrative - Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Consultar el perfil del usuario autenticado' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findOne(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Actualizar información básica del perfil' })
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.service.updateProfile(user.id, dto);
  }

  @Post('guide-teachers')
  @Permissions(PERMISSIONS.ADMINISTRATOR_CREATE)
  @ApiOperation({ summary: 'Crear docente guía' })
  createGuideTeacher(@Body() dto: CreateGuideTeacherDto) {
    return this.service.createGuideTeacher(dto);
  }

  @Get('guide-teachers')
  @Permissions(PERMISSIONS.ADMINISTRATOR_VIEW)
  @ApiOperation({ summary: 'Listar docentes guía disponibles' })
  findGuideTeachers() {
    return this.service.findGuideTeachers();
  }

  @Patch('guide-teachers/:id')
  @Permissions(PERMISSIONS.ADMINISTRATOR_EDIT)
  @ApiOperation({ summary: 'Editar docente guía' })
  updateGuideTeacher(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGuideTeacherDto,
    @CurrentUser() actor?: AuthenticatedUser,
  ) {
    return this.service.updateGuideTeacher(id, dto, actor?.id);
  }

  @Delete('guide-teachers/:id')
  @Permissions(PERMISSIONS.ADMINISTRATOR_DELETE)
  @ApiOperation({ summary: 'Inactivar docente guía y quitar asignaciones' })
  removeGuideTeacher(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor?: AuthenticatedUser,
  ) {
    return this.service.removeGuideTeacher(id, actor?.id);
  }

  @Post()
  @Permissions(PERMISSIONS.ADMINISTRATOR_CREATE)
  @ApiOperation({ summary: 'Registro manual de usuario (WF-17 / PBI-15)' })
  create(@Body() dto: CreateUserDto, @CurrentUser() actor?: AuthenticatedUser) {
    return this.service.create(dto, actor?.id);
  }

  @Get()
  @Permissions(PERMISSIONS.ADMINISTRATOR_VIEW)
  @ApiOperation({
    summary: 'Listar usuarios',
    description:
      'Sin query params: lista completa (compat). Con page/limit/status/roleId/search: respuesta paginada.',
  })
  findAll(@Query() query: ListUsersQueryDto) {
    const hasListParams =
      query.page !== undefined ||
      query.limit !== undefined ||
      query.status !== undefined ||
      query.roleId !== undefined ||
      query.search !== undefined;

    if (hasListParams) {
      return this.service.findPage(query);
    }
    return this.service.findAll();
  }

  @Get(':id/audit-logs')
  @Permissions(PERMISSIONS.ADMINISTRATOR_VIEW)
  @ApiOperation({ summary: 'Historial de auditoría del usuario (WF-18)' })
  findAuditLogs(@Param('id', ParseIntPipe) id: number) {
    return this.service.findAuditLogs(id);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.ADMINISTRATOR_VIEW)
  @ApiOperation({ summary: 'Consultar usuario (WF-18)' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.ADMINISTRATOR_EDIT)
  @ApiOperation({ summary: 'Editar usuario y registrar auditoría (WF-18)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor?: AuthenticatedUser,
  ) {
    return this.service.update(id, dto, actor?.id);
  }
}
