import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { FileAppealDto, FileRevocationDto, ResolveAppealDto } from '../dto/appeal.dto';
import { ListDisciplinaryAppealsQueryDto } from '../dto/list-disciplinary-appeals-query.dto';
import { DisciplinaryAppealQueryService } from '../services/disciplinary-appeal-query.service';
import { DisciplinaryAppealsService } from '../services/disciplinary-appeals.service';

@ApiTags('Disciplinary - Recursos')
@ApiBearerAuth()
@Controller('disciplinary')
export class DisciplinaryAppealsController {
  constructor(
    private readonly appeals: DisciplinaryAppealsService,
    private readonly query: DisciplinaryAppealQueryService,
  ) {}

  @Get('appeals/eligible')
  @ApiOperation({ summary: 'Expedientes en los que el actor puede interponer un recurso según Sprint 4' })
  listEligible(@CurrentUser() actor: AuthenticatedUser) {
    return this.query.listEligible(actor);
  }

  @Get('appeals/review')
  @ApiOperation({ summary: 'Recursos pendientes que el actor autenticado puede resolver según Sprint 4' })
  listReviewable(@CurrentUser() actor: AuthenticatedUser, @Query() filters: ListDisciplinaryAppealsQueryDto) {
    return this.query.listReviewable(actor, filters);
  }

  @Get('appeals/review/:id')
  @ApiOperation({ summary: 'Detalle de un recurso pendiente autorizado para revisión' })
  getReviewable(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    return this.query.getReviewable(actor, id);
  }

  @Get('appeals/dashboard')
  @Permissions(PERMISSIONS.DISCIPLINARY_READ)
  @ApiOperation({ summary: 'Indicadores de recursos disciplinarios para Dirección y Administración' })
  dashboard(@CurrentUser() actor: AuthenticatedUser, @Query() filters: ListDisciplinaryAppealsQueryDto) {
    return this.query.dashboard(actor, filters);
  }

  @Get('appeals/:id')
  @ApiOperation({ summary: 'Seguimiento de un recurso autorizado: cronología, notificación y rebajo' })
  getTracking(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    return this.query.getTracking(actor, id);
  }

  @Get('appeals')
  @ApiOperation({ summary: 'Listar recursos disciplinarios con alcance del actor' })
  list(@CurrentUser() actor: AuthenticatedUser, @Query() filters: ListDisciplinaryAppealsQueryDto) {
    return this.query.list(actor, filters);
  }

  @Post('cases/:id/revocations')
  @ApiOperation({ summary: 'Interponer revocatoria, con apelación en subsidio si se indica' })
  fileRevocation(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: FileRevocationDto,
  ) {
    return this.appeals.fileRevocation(actor, id, dto);
  }

  @Post('cases/:id/appeals')
  @ApiOperation({ summary: 'Interponer apelación ante Dirección tras el rechazo de la revocatoria' })
  fileAppeal(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: FileAppealDto,
  ) {
    return this.appeals.fileAppeal(actor, id, dto);
  }

  @Post('cases/:id/revocations/:appealId/resolution')
  @Permissions(PERMISSIONS.DISCIPLINARY_RESOLVE)
  @ApiOperation({ summary: 'Resolver la revocatoria: Acoge o Rechaza' })
  resolveRevocation(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('appealId', ParseIntPipe) appealId: number,
    @Body() dto: ResolveAppealDto,
  ) {
    return this.appeals.resolveRevocation(actor, id, appealId, dto);
  }

  @Post('cases/:id/appeals/:appealId/resolution')
  @Permissions(PERMISSIONS.DISCIPLINARY_APPEAL)
  @ApiOperation({ summary: 'Resolver la apelación: Acoge, Acoge parcialmente o Rechaza' })
  resolveAppeal(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('appealId', ParseIntPipe) appealId: number,
    @Body() dto: ResolveAppealDto,
  ) {
    return this.appeals.resolveAppeal(actor, id, appealId, dto);
  }
}
