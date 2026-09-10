import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Permissions } from '../../../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../../../common/constants/permissions.constant';
import { AssignPermissionsDto } from '../dto/assign-permissions.dto';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { RolesService } from '../services/roles.service';

@ApiTags('Administrative - Roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly service: RolesService) {}

  @Post()
  @Permissions(PERMISSIONS.ROLES_PERMISSIONS_CREATE)
  @ApiOperation({ summary: 'Crear rol' })
  create(@Body() dto: CreateRoleDto) {
    return this.service.create(dto);
  }

  @Get()
  @Permissions(PERMISSIONS.ROLES_PERMISSIONS_VIEW)
  @ApiOperation({ summary: 'Listar roles' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @Permissions(PERMISSIONS.ROLES_PERMISSIONS_VIEW)
  @ApiOperation({ summary: 'Obtener rol por ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @Permissions(PERMISSIONS.ROLES_PERMISSIONS_EDIT)
  @ApiOperation({ summary: 'Actualizar rol' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.ROLES_PERMISSIONS_DELETE)
  @ApiOperation({ summary: 'Inactivar rol (eliminación lógica)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  @Put(':id/permissions')
  @Permissions(PERMISSIONS.ROLES_PERMISSIONS_EDIT)
  @ApiOperation({ summary: 'Asignar permisos a un rol (reemplaza el set)' })
  assignPermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignPermissionsDto,
  ) {
    return this.service.assignPermissions(id, dto);
  }
}
