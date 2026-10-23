import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseFilePipeBuilder,
  ParseIntPipe,
  Post,
  Req,
  StreamableFile,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { Request } from 'express';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { SkipResponseWrap } from '../../../common/decorators/skip-response-wrap.decorator';
import { requestClientMeta } from '../../auth/utils/request-client-meta';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { FileDefenseDto } from '../dto/defense.dto';
import { PhysicalFormalCommunicationDto, RecordPhysicalDeliveryDto } from '../dto/physical-delivery.dto';
import { DisciplinaryDefenseService } from '../services/disciplinary-defense.service';
import { DisciplinaryDeliveryService } from '../services/disciplinary-delivery.service';
import { DisciplinaryNotificationsService } from '../services/disciplinary-notifications.service';
import { EVIDENCE_MAX_BYTES } from '../services/evidence-file';

@ApiTags('Disciplinary - Comunicaciones')
@ApiBearerAuth()
@Controller('disciplinary')
export class DisciplinaryCommunicationsController {
  constructor(
    private readonly delivery: DisciplinaryDeliveryService,
    private readonly notifications: DisciplinaryNotificationsService,
    private readonly defenses: DisciplinaryDefenseService,
  ) {}

  @Get('notifications/mine')
  @ApiOperation({ summary: 'Bandeja de notificaciones del encargado y contador de no leídas' })
  listMine(@CurrentUser() actor: AuthenticatedUser) {
    return this.notifications.mine(actor);
  }

  @Post('notifications/:id/read')
  @ApiOperation({ summary: 'Confirmar la lectura de una notificación, de forma inmutable' })
  confirmRead(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Req() request: Request,
  ) {
    return this.notifications.confirmRead(actor, id, requestClientMeta(request));
  }

  @Post('cases/:id/defenses/written')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Registrar el descargo entregado por escrito' })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: EVIDENCE_MAX_BYTES } }))
  fileWrittenDefense(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: FileDefenseDto,
    @UploadedFile(
      new ParseFilePipeBuilder().addMaxSizeValidator({ maxSize: EVIDENCE_MAX_BYTES }).build({
        fileIsRequired: true,
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.defenses.fileWritten(actor, id, dto, file);
  }

  @Post('cases/:id/defenses')
  @Permissions(PERMISSIONS.DISCIPLINARY_RESPOND)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Presentar el descargo del encargado, con hasta 3 adjuntos, dentro del plazo' })
  @UseInterceptors(FilesInterceptor('files', 3, { storage: memoryStorage(), limits: { fileSize: EVIDENCE_MAX_BYTES } }))
  filePortalDefense(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: FileDefenseDto,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ) {
    return this.defenses.fileFromPortal(actor, id, dto, files ?? []);
  }

  @Post('cases/:id/communications/:communicationId/delivery')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        medium: { type: 'string', enum: ['NOTEBOOK', 'IN_PERSON'] },
        deliveredOn: { type: 'string', example: '2026-10-19' },
        receivedByName: { type: 'string' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'Registrar la entrega física de una comunicación, con acuse opcional' })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: EVIDENCE_MAX_BYTES } }))
  recordDelivery(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('communicationId', ParseIntPipe) communicationId: number,
    @Body() dto: RecordPhysicalDeliveryDto,
    @UploadedFile(
      new ParseFilePipeBuilder().addMaxSizeValidator({ maxSize: EVIDENCE_MAX_BYTES }).build({
        fileIsRequired: false,
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      }),
    )
    file?: Express.Multer.File,
  ) {
    return this.delivery.recordDelivery(actor, id, communicationId, dto, file);
  }

  @Post('cases/:id/formal-communication/physical')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Crear la comunicación formal mediante entrega física si no hay encargado vinculado' })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: EVIDENCE_MAX_BYTES } }))
  deliverFormalCharge(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PhysicalFormalCommunicationDto,
    @UploadedFile(
      new ParseFilePipeBuilder().addMaxSizeValidator({ maxSize: EVIDENCE_MAX_BYTES }).build({
        fileIsRequired: false,
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      }),
    )
    file?: Express.Multer.File,
  ) {
    return this.delivery.deliverFormalCharge(actor, id, dto, file);
  }

  @Get('cases/:id/communications/:communicationId/pdf')
  @SkipResponseWrap()
  @ApiOperation({ summary: 'PDF imprimible de una comunicación del expediente' })
  downloadCommunicationPdf(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('communicationId', ParseIntPipe) communicationId: number,
  ): Promise<StreamableFile> {
    return this.delivery.pdf(actor, id, communicationId);
  }
}
