import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DisciplinaryService } from '../services/disciplinary.service';
import { DisciplinaryFollowUpService } from '../services/disciplinary-follow-up.service';
import { CreateDisciplinaryActionDto } from '../dto/create-disciplinary-action.dto';
import { UpdateDisciplinaryActionDto } from '../dto/update-disciplinary-action.dto';
import { DisciplinaryFilterDto } from '../dto/disciplinary-filter.dto';
import { FollowUpDisciplinaryActionDto } from '../dto/follow-up-disciplinary-action.dto';

@ApiTags('Disciplinary')
@ApiBearerAuth()
@Controller('disciplinary')
export class DisciplinaryController {
  constructor(
    private readonly disciplinaryService: DisciplinaryService,
    private readonly followUpService: DisciplinaryFollowUpService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Registrar amonestación (stub)' })
  create(@Body() dto: CreateDisciplinaryActionDto) {
    return this.disciplinaryService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar amonestaciones (stub)' })
  findAll(@Query() filter: DisciplinaryFilterDto) {
    return this.disciplinaryService.findAll(filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de amonestación (stub)' })
  findOne(@Param('id') id: string) {
    return this.disciplinaryService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar amonestación (stub)' })
  update(@Param('id') id: string, @Body() dto: UpdateDisciplinaryActionDto) {
    return this.disciplinaryService.update(id, dto);
  }

  @Post(':id/follow-ups')
  @ApiOperation({ summary: 'Agregar seguimiento (stub)' })
  followUp(@Param('id') id: string, @Body() dto: FollowUpDisciplinaryActionDto) {
    return this.followUpService.addFollowUp(id, dto);
  }
}
