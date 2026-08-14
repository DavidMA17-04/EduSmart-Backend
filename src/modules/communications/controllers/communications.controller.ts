import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CommunicationsService } from '../services/communications.service';
import { CommunicationTargetingService } from '../services/communication-targeting.service';
import { ReadingConfirmationService } from '../services/reading-confirmation.service';
import { CreateCommunicationDto } from '../dto/create-communication.dto';
import { UpdateCommunicationDto } from '../dto/update-communication.dto';
import { CommunicationFilterDto } from '../dto/communication-filter.dto';
import { CommunicationTargetDto } from '../dto/communication-target.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';

@ApiTags('Communications')
@ApiBearerAuth()
@Controller('communications')
export class CommunicationsController {
  constructor(
    private readonly communicationsService: CommunicationsService,
    private readonly targetingService: CommunicationTargetingService,
    private readonly readingConfirmationService: ReadingConfirmationService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear comunicado (stub)' })
  create(@Body() dto: CreateCommunicationDto) {
    return this.communicationsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar comunicados (stub)' })
  findAll(@Query() filter: CommunicationFilterDto) {
    return this.communicationsService.findAll(filter);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar comunicado (stub)' })
  update(@Param('id') id: string, @Body() dto: UpdateCommunicationDto) {
    return this.communicationsService.update(id, dto);
  }

  @Post(':id/targets')
  @ApiOperation({ summary: 'Definir destinatarios (stub)' })
  setTargets(@Param('id') id: string, @Body() targets: CommunicationTargetDto[]) {
    return this.targetingService.setTargets(id, targets);
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Confirmar lectura (stub)' })
  confirmRead(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.readingConfirmationService.confirmRead(id, user.id);
  }
}
