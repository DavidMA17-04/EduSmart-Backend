import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../../../common/constants/permissions.constant';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { actorSeesFullAcademicHistory } from '../../shared/academic-visibility.util';
import { AssignGuideTeacherDto } from '../dto/assign-guide-teacher.dto';
import { CreateGroupDto } from '../dto/create-group.dto';
import { UpdateGroupDto } from '../dto/update-group.dto';
import { GroupsService } from '../services/groups.service';

@ApiTags('Administrative - Groups')
@ApiBearerAuth()
@Controller('groups')
export class GroupsController {
  constructor(private readonly service: GroupsService) {}

  @Post()
  @Permissions(PERMISSIONS.SECTIONS_CREATE)
  @ApiOperation({ summary: 'Crear sección (cascarón con cupo máximo)' })
  create(@Body() dto: CreateGroupDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar secciones (Admin/Director: historial; resto: año activo)',
  })
  findAll(@CurrentUser() actor: AuthenticatedUser) {
    if (actorSeesFullAcademicHistory(actor?.roles ?? [])) {
      return this.service.findAll();
    }
    return this.service.findVisibleForTeacher();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener sección por ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Put(':id/guide-teacher')
  @Permissions(PERMISSIONS.SECTIONS_EDIT)
  @ApiOperation({ summary: 'Asignar docente guía a la sección' })
  assignGuideTeacher(@Param('id', ParseIntPipe) id: number, @Body() dto: AssignGuideTeacherDto) {
    return this.service.assignGuideTeacher(id, dto);
  }

  @Put(':id')
  @Permissions(PERMISSIONS.SECTIONS_EDIT)
  @ApiOperation({ summary: 'Actualizar sección' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateGroupDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(PERMISSIONS.SECTIONS_EDIT)
  @ApiOperation({ summary: 'Eliminar sección' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.service.remove(id);
  }
}
