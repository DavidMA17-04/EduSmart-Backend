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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Permissions } from '../../../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../../../common/constants/permissions.constant';
import { CreatePermissionDto } from '../dto/create-permission.dto';
import { UpdatePermissionDto } from '../dto/update-permission.dto';
import { PermissionsService } from '../services/permissions.service';

@ApiTags('Administrative - Permissions')
@ApiBearerAuth()
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly service: PermissionsService) {}

  @Post()
  @Permissions(PERMISSIONS.ROLES_PERMISSIONS_CREATE)
  @ApiOperation({ summary: 'Crear permiso' })
  create(@Body() dto: CreatePermissionDto) {
    return this.service.create(dto);
  }

  @Get()
  @Permissions(PERMISSIONS.ROLES_PERMISSIONS_VIEW)
  @ApiOperation({ summary: 'Listar permisos' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @Permissions(PERMISSIONS.ROLES_PERMISSIONS_VIEW)
  @ApiOperation({ summary: 'Obtener permiso por ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @Permissions(PERMISSIONS.ROLES_PERMISSIONS_EDIT)
  @ApiOperation({ summary: 'Actualizar permiso' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePermissionDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(PERMISSIONS.ROLES_PERMISSIONS_DELETE)
  @ApiOperation({ summary: 'Eliminar permiso (si no está asignado a roles)' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.service.remove(id);
  }
}
