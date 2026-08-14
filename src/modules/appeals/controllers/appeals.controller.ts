import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppealsService } from '../services/appeals.service';
import { AppealResolutionService } from '../services/appeal-resolution.service';
import { CreateAppealDto } from '../dto/create-appeal.dto';
import { ReviewAppealDto } from '../dto/review-appeal.dto';
import { ResolveAppealDto } from '../dto/resolve-appeal.dto';
import { AppealFilterDto } from '../dto/appeal-filter.dto';

@ApiTags('Appeals')
@ApiBearerAuth()
@Controller('appeals')
export class AppealsController {
  constructor(
    private readonly appealsService: AppealsService,
    private readonly appealResolutionService: AppealResolutionService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Registrar apelación (stub)' })
  create(@Body() dto: CreateAppealDto) {
    return this.appealsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar apelaciones (stub)' })
  findAll(@Query() filter: AppealFilterDto) {
    return this.appealsService.findAll(filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de apelación (stub)' })
  findOne(@Param('id') id: string) {
    return this.appealsService.findOne(id);
  }

  @Patch(':id/review')
  @ApiOperation({ summary: 'Revisar apelación (stub)' })
  review(@Param('id') id: string, @Body() dto: ReviewAppealDto) {
    return this.appealsService.review(id, dto);
  }

  @Post(':id/resolve')
  @ApiOperation({ summary: 'Resolver apelación (stub)' })
  resolve(@Param('id') id: string, @Body() dto: ResolveAppealDto) {
    return this.appealResolutionService.resolve(id, dto);
  }
}
