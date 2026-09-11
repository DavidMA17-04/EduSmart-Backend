import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../../../common/constants/permissions.constant';
import { CreateTeachingAssignmentDto } from '../dto/create-teaching-assignment.dto';
import { UpdateTeachingAssignmentDto } from '../dto/update-teaching-assignment.dto';
import { TeachingAssignmentsService } from '../services/teaching-assignments.service';

function optionalPositiveInt(
  raw: string | undefined,
  field: string,
): number | undefined {
  if (raw == null || raw === '') return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new BadRequestException(`${field} must be a positive integer`);
  }
  return value;
}

@ApiTags('Administrative - Teaching Assignments')
@ApiBearerAuth()
@Controller('teaching-assignments')
export class TeachingAssignmentsController {
  constructor(private readonly service: TeachingAssignmentsService) {}

  @Post()
  @Permissions(PERMISSIONS.ACADEMIC_STRUCTURE_EDIT)
  @ApiOperation({
    summary: 'Asignar docente a oferta+grupo (con elegibilidad por grado)',
  })
  create(@Body() dto: CreateTeachingAssignmentDto) {
    return this.service.create(dto);
  }

  @Get()
  @Permissions(PERMISSIONS.ACADEMIC_STRUCTURE_VIEW)
  @ApiOperation({
    summary:
      'Listar asignaciones impartibles (filtros opcionales: groupId, teacherId, periodId)',
  })
  list(
    @Query('groupId') groupId?: string,
    @Query('teacherId') teacherId?: string,
    @Query('periodId') periodId?: string,
  ) {
    return this.service.list({
      groupId: optionalPositiveInt(groupId, 'groupId'),
      teacherId: optionalPositiveInt(teacherId, 'teacherId'),
      periodId: optionalPositiveInt(periodId, 'periodId'),
    });
  }

  @Get(':id')
  @Permissions(PERMISSIONS.ACADEMIC_STRUCTURE_VIEW)
  @ApiOperation({ summary: 'Obtener asignación docente' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @Permissions(PERMISSIONS.ACADEMIC_STRUCTURE_EDIT)
  @ApiOperation({ summary: 'Actualizar asignación docente' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTeachingAssignmentDto,
  ) {
    return this.service.update(id, dto);
  }
}
