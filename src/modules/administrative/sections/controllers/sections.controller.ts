import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SectionsService } from '../services/sections.service';

@ApiTags('Administrative - Sections')
@ApiBearerAuth()
@Controller('sections')
export class SectionsController {
  constructor(private readonly service: SectionsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar sections (stub)' })
  findAll() {
    return this.service.findAll();
  }
}
