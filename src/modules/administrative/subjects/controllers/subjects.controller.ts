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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../../../common/constants/permissions.constant';
import { CreateSubjectDto } from '../dto/create-subject.dto';
import { UpdateSubjectDto } from '../dto/update-subject.dto';
import { SubjectsService } from '../services/subjects.service';

@ApiTags('Administrative - Subjects')
@ApiBearerAuth()
@Controller('subjects')
export class SubjectsController {
  constructor(private readonly service: SubjectsService) {}

  @Post()
  @Permissions(PERMISSIONS.ACADEMIC_STRUCTURE_EDIT)
  @ApiOperation({ summary: 'Crear materia regular' })
  create(@Body() dto: CreateSubjectDto) {
    return this.service.create(dto);
  }

  @Get()
  @Permissions(PERMISSIONS.ACADEMIC_STRUCTURE_VIEW)
  @ApiOperation({ summary: 'Listar materias regulares' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @Permissions(PERMISSIONS.ACADEMIC_STRUCTURE_VIEW)
  @ApiOperation({ summary: 'Obtener materia por ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @Permissions(PERMISSIONS.ACADEMIC_STRUCTURE_EDIT)
  @ApiOperation({ summary: 'Actualizar materia' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSubjectDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.ACADEMIC_STRUCTURE_EDIT)
  @ApiOperation({ summary: 'Inactivar materia (eliminación lógica)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
