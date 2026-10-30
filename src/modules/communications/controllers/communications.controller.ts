import {
  Body,
  ForbiddenException,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CommunicationsService } from '../services/communications.service';
import { CommunicationTargetingService } from '../services/communication-targeting.service';
import { ReadingConfirmationService } from '../services/reading-confirmation.service';
import { CreateCommunicationDto } from '../dto/create-communication.dto';
import { UpdateCommunicationDto } from '../dto/update-communication.dto';
import { CommunicationFilterDto } from '../dto/communication-filter.dto';
import { AudienceEstimateDto, CommunicationTargetDto } from '../dto/communication-target.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { CommunicationStatus } from '../entities/communication.entity';
import { institutionalRoleMatches } from '../../../common/utils/institutional-role-match.util';

@ApiTags('Communications')
@ApiBearerAuth()
@Controller('communications')
export class CommunicationsController {
  constructor(
    private readonly communicationsService: CommunicationsService,
    private readonly targetingService: CommunicationTargetingService,
    private readonly readingConfirmationService: ReadingConfirmationService,
  ) {}

  @Get('feed')
  @Permissions(PERMISSIONS.COMMUNICATIONS_READ)
  @ApiOperation({ summary: 'Obtener muro/feed de comunicados para el usuario actual' })
  getFeed(
    @Query() filter: CommunicationFilterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.communicationsService.findFeed(filter, user);
  }

  @Get('admin')
  @Permissions(PERMISSIONS.COMMUNICATIONS_CREATE)
  @ApiOperation({ summary: 'Listar comunicados para administración (borradores, publicados, archivados)' })
  getAdminList(
    @Query() filter: CommunicationFilterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.communicationsService.findAdminList(filter, user);
  }

  @Get('target-options')
  @Permissions(PERMISSIONS.COMMUNICATIONS_CREATE)
  @ApiOperation({ summary: 'Obtener opciones de roles y secciones para selector de audiencia' })
  getTargetOptions() {
    return this.communicationsService.getTargetOptions();
  }

  @Post('audience-estimate')
  @Permissions(PERMISSIONS.COMMUNICATIONS_CREATE)
  @ApiOperation({ summary: 'Estimar cuántos usuarios activos alcanza una segmentación' })
  estimateAudience(@Body() dto: AudienceEstimateDto) {
    return this.communicationsService.estimateAudience(dto.recipients);
  }

  @Post()
  @Permissions(PERMISSIONS.COMMUNICATIONS_CREATE)
  @ApiOperation({ summary: 'Crear comunicado' })
  create(
    @Body() dto: CreateCommunicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (dto.status === CommunicationStatus.PUBLISHED && !user.permissions.includes(PERMISSIONS.COMMUNICATIONS_PUBLISH) &&
      !institutionalRoleMatches(user.roles, ['ADMIN'])) {
      throw new ForbiddenException('No tienes permiso para publicar comunicados');
    }
    return this.communicationsService.create(dto, user.id);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.COMMUNICATIONS_READ)
  @ApiOperation({ summary: 'Obtener detalle de comunicado' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.communicationsService.findOne(id, user);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.COMMUNICATIONS_CREATE)
  @ApiOperation({ summary: 'Actualizar comunicado' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCommunicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.communicationsService.update(id, dto, user);
  }

  @Post(':id/publish')
  @Permissions(PERMISSIONS.COMMUNICATIONS_PUBLISH)
  @ApiOperation({ summary: 'Publicar comunicado' })
  publish(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.communicationsService.publish(id, user);
  }

  @Post(':id/archive')
  @Permissions(PERMISSIONS.COMMUNICATIONS_CREATE)
  @ApiOperation({ summary: 'Archivar comunicado' })
  archive(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.communicationsService.archive(id, user);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.COMMUNICATIONS_CREATE)
  @ApiOperation({ summary: 'Eliminar comunicado' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.communicationsService.remove(id, user);
  }

  @Post(':id/targets')
  @Permissions(PERMISSIONS.COMMUNICATIONS_CREATE)
  @ApiOperation({ summary: 'Definir destinatarios de un comunicado' })
  setTargets(
    @Param('id') id: string,
    @Body() targets: CommunicationTargetDto[],
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.communicationsService.update(id, { recipients: targets }, user);
  }

  @Post(':id/read')
  @Permissions(PERMISSIONS.COMMUNICATIONS_READ)
  @ApiOperation({ summary: 'Marcar comunicado como leído' })
  markRead(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.readingConfirmationService.markAsRead(id, user.id);
  }

  @Post(':id/acknowledge')
  @Permissions(PERMISSIONS.COMMUNICATIONS_READ)
  @ApiOperation({ summary: 'Confirmar lectura / Acuse de recibo de comunicado' })
  confirmAcknowledgment(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.readingConfirmationService.confirmRead(id, user.id);
  }

  @Get(':id/stats')
  @Permissions(PERMISSIONS.COMMUNICATIONS_CREATE)
  @ApiOperation({ summary: 'Obtener estadísticas detalladas de lectura del comunicado' })
  getStats(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.communicationsService.getStats(id, user);
  }
}
