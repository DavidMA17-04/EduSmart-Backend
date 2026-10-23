import { Body, Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { FileAppealDto, FileRevocationDto, ResolveAppealDto } from '../dto/appeal.dto';
import { DisciplinaryAppealsService } from '../services/disciplinary-appeals.service';

@ApiTags('Disciplinary - Recursos')
@ApiBearerAuth()
@Controller('disciplinary')
export class DisciplinaryAppealsController {
  constructor(private readonly appeals: DisciplinaryAppealsService) {}

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
