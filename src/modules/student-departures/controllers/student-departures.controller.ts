import { Body, Controller, Get, Post, Query, Req, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { SkipResponseWrap } from '../../../common/decorators/skip-response-wrap.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { requestClientMeta } from '../../auth/utils/request-client-meta';
import { CreateDepartureDto } from '../dto/create-departure.dto';
import { DepartureHistoryFilterDto } from '../dto/departure-history-filter.dto';
import { ValidateGuardianDto } from '../dto/validate-guardian.dto';
import { DepartureValidationService } from '../services/departure-validation.service';
import { StudentDeparturesExportService } from '../services/student-departures-export.service';
import { StudentDeparturesService } from '../services/student-departures.service';
import { costaRicaDateString } from '../utils/costa-rica-time';

@ApiTags('Student departures')
@ApiBearerAuth()
@Controller('student-departures')
export class StudentDeparturesController {
  constructor(
    private readonly validation: DepartureValidationService,
    private readonly departures: StudentDeparturesService,
    private readonly exporter: StudentDeparturesExportService,
  ) {}

  @Post('validate-guardian')
  @Permissions(PERMISSIONS.DEPARTURES_VALIDATE)
  @ApiOperation({ summary: 'Validar que el encargado presente está vinculado al estudiante' })
  validateGuardian(
    @Body() dto: ValidateGuardianDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.validation.validateGuardian(
      dto.studentIdentifier,
      dto.guardianIdentifier,
      user,
      requestClientMeta(req),
    );
  }

  @Post()
  @Permissions(PERMISSIONS.DEPARTURES_CREATE)
  @ApiOperation({ summary: 'Registrar una salida autorizada o un intento denegado' })
  create(
    @Body() dto: CreateDepartureDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.departures.register(dto, user, requestClientMeta(req));
  }

  @Get('today-kpis')
  @Permissions(PERMISSIONS.DEPARTURES_VIEW_HISTORY)
  @ApiOperation({ summary: 'Indicadores de la jornada (hora de Costa Rica)' })
  todayKpis() {
    return this.departures.todayKpis();
  }

  @Get('history')
  @Permissions(PERMISSIONS.DEPARTURES_VIEW_HISTORY)
  @ApiOperation({ summary: 'Bitácora paginada con filtros' })
  history(@Query() filter: DepartureHistoryFilterDto) {
    return this.departures.history(filter);
  }

  @Get('groups')
  @Permissions(PERMISSIONS.DEPARTURES_VIEW_HISTORY)
  @ApiOperation({ summary: 'Secciones activas para filtrar la bitácora' })
  groups() {
    return this.departures.groups();
  }

  @Get('export/excel')
  @SkipResponseWrap()
  @Permissions(PERMISSIONS.DEPARTURES_EXPORT)
  @ApiOperation({ summary: 'Exportar la bitácora en Excel' })
  @ApiProduces('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async exportExcel(@Query() filter: DepartureHistoryFilterDto): Promise<StreamableFile> {
    const buffer = await this.exporter.excel(filter);
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="bitacora-salidas-${costaRicaDateString()}.xlsx"`,
      length: buffer.length,
    });
  }

  @Get('export/pdf')
  @SkipResponseWrap()
  @Permissions(PERMISSIONS.DEPARTURES_EXPORT)
  @ApiOperation({ summary: 'Exportar la bitácora en PDF' })
  @ApiProduces('application/pdf')
  async exportPdf(@Query() filter: DepartureHistoryFilterDto): Promise<StreamableFile> {
    const buffer = await this.exporter.pdf(filter);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="bitacora-salidas-${costaRicaDateString()}.pdf"`,
      length: buffer.length,
    });
  }
}
