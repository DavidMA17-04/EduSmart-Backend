import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { SkipResponseWrap } from '../../../common/decorators/skip-response-wrap.decorator';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import {
  CreateInfractionTypeDto,
  ListInfractionTypesQueryDto,
  UpdateInfractionTypeDto,
} from '../dto/infraction-type.dto';
import { InfractionTypesExportService } from '../services/infraction-types-export.service';
import { InfractionTypesService } from '../services/infraction-types.service';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@ApiTags('Disciplinary - Catálogo de faltas')
@ApiBearerAuth()
@Controller('disciplinary')
export class InfractionTypesController {
  constructor(
    private readonly service: InfractionTypesService,
    private readonly exports: InfractionTypesExportService,
  ) {}

  @Get('severity-rules')
  @Permissions(PERMISSIONS.DISCIPLINARY_READ)
  @ApiOperation({ summary: 'Escala de gravedad REAC: rebajo fijo y vía procesal' })
  listSeverityRules() {
    return this.service.listSeverityRules();
  }

  @Get('infraction-types')
  @Permissions(PERMISSIONS.DISCIPLINARY_READ)
  @ApiOperation({ summary: 'Listar tipos de falta' })
  list(@Query() query: ListInfractionTypesQueryDto) {
    return this.service.findAll(query);
  }

  @Get('infraction-types/export/excel')
  @Permissions(PERMISSIONS.DISCIPLINARY_EXPORT)
  @SkipResponseWrap()
  @Header('Content-Type', XLSX_MIME)
  @Header('Content-Disposition', 'attachment; filename="catalogo-faltas.xlsx"')
  @ApiProduces(XLSX_MIME)
  @ApiOperation({ summary: 'Exportar catálogo de faltas a Excel' })
  async exportExcel(@Query() query: ListInfractionTypesQueryDto): Promise<StreamableFile> {
    const buffer = await this.exports.exportExcel(query);
    return new StreamableFile(buffer, {
      type: XLSX_MIME,
      disposition: 'attachment; filename="catalogo-faltas.xlsx"',
    });
  }

  @Get('infraction-types/export/pdf')
  @Permissions(PERMISSIONS.DISCIPLINARY_EXPORT)
  @SkipResponseWrap()
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="catalogo-faltas.pdf"')
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'Exportar catálogo de faltas a PDF' })
  async exportPdf(@Query() query: ListInfractionTypesQueryDto): Promise<StreamableFile> {
    const buffer = await this.exports.exportPdf(query);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: 'attachment; filename="catalogo-faltas.pdf"',
    });
  }

  @Get('infraction-types/options')
  @Permissions(PERMISSIONS.DISCIPLINARY_CREATE)
  @ApiOperation({ summary: 'Tipos de falta activos para registrar una amonestación' })
  listOptions() {
    return this.service.findAll({ active: true });
  }

  @Get('infraction-types/:id')
  @Permissions(PERMISSIONS.DISCIPLINARY_READ)
  @ApiOperation({ summary: 'Detalle de tipo de falta' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post('infraction-types')
  @Permissions(PERMISSIONS.DISCIPLINARY_CONFIGURE)
  @ApiOperation({ summary: 'Crear tipo de falta' })
  create(@Body() dto: CreateInfractionTypeDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.service.create(dto, actor);
  }

  @Patch('infraction-types/:id')
  @Permissions(PERMISSIONS.DISCIPLINARY_CONFIGURE)
  @ApiOperation({ summary: 'Editar o reactivar tipo de falta' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInfractionTypeDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.update(id, dto, actor);
  }

  @Delete('infraction-types/:id')
  @Permissions(PERMISSIONS.DISCIPLINARY_CONFIGURE)
  @ApiOperation({ summary: 'Desactivar tipo de falta (sin borrado)' })
  deactivate(@Param('id', ParseIntPipe) id: number, @CurrentUser() actor: AuthenticatedUser) {
    return this.service.deactivate(id, actor);
  }
}
