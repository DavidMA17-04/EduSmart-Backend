import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StudentsService } from '../services/students.service';
import { GuardiansService } from '../services/guardians.service';
import { CreateStudentDto } from '../dto/create-student.dto';
import { UpdateStudentDto } from '../dto/update-student.dto';
import { StudentFilterDto } from '../dto/student-filter.dto';
import { AssignGuardianDto } from '../dto/assign-guardian.dto';

@ApiTags('Students')
@ApiBearerAuth()
@Controller('students')
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly guardiansService: GuardiansService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Registrar estudiante (stub)' })
  create(@Body() dto: CreateStudentDto) {
    return this.studentsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar estudiantes (stub)' })
  findAll(@Query() filter: StudentFilterDto) {
    return this.studentsService.findAll(filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar estudiante (stub)' })
  findOne(@Param('id') id: string) {
    return this.studentsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar estudiante (stub)' })
  update(@Param('id') id: string, @Body() dto: UpdateStudentDto) {
    return this.studentsService.update(id, dto);
  }

  @Post(':id/guardians')
  @ApiOperation({ summary: 'Asociar encargado (stub)' })
  assignGuardian(@Param('id') id: string, @Body() dto: AssignGuardianDto) {
    return this.guardiansService.assignToStudent(id, dto);
  }
}
