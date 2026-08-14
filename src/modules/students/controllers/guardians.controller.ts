import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GuardiansService } from '../services/guardians.service';

@ApiTags('Guardians')
@ApiBearerAuth()
@Controller('guardians')
export class GuardiansController {
  constructor(private readonly guardiansService: GuardiansService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Consultar encargado (stub)' })
  findOne(@Param('id') id: string) {
    return this.guardiansService.findOne(id);
  }
}
