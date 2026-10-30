import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../../../common/constants/permissions.constant';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { actorSeesFullAcademicHistory } from '../../shared/academic-visibility.util';
import { CreateSectionDto } from '../dto/create-section.dto';
import { UpdateSectionDto } from '../dto/update-section.dto';
import { SectionsService } from '../services/sections.service';

@ApiTags('Administrative - Sections')
@ApiBearerAuth()
@Controller('sections')
export class SectionsController {
  constructor(private readonly service: SectionsService) {}

  @Post()
  @Permissions(PERMISSIONS.SECTIONS_CREATE)
  @ApiOperation({ summary: 'Crear nivel' })
  create(@Body() dto: CreateSectionDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar niveles (Admin/Director: historial; resto: año activo)',
  })
  findAll(@CurrentUser() actor: AuthenticatedUser) {
    if (actorSeesFullAcademicHistory(actor?.roles ?? [])) {
      return this.service.findAll();
    }
    return this.service.findVisibleForTeacher();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener nivel por ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @Permissions(PERMISSIONS.SECTIONS_EDIT)
  @ApiOperation({ summary: 'Actualizar nivel' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSectionDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.SECTIONS_EDIT)
  @ApiOperation({ summary: 'Inactivar nivel' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
