import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { ParseFilePipeBuilder } from '@nestjs/common';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { CreateJustificationDto } from '../dto/create-justification.dto';
import { JustifiableAbsencesQueryDto } from '../dto/justifiable-absences-query.dto';
import { ListJustificationsQueryDto } from '../dto/list-justifications-query.dto';
import { ReviewJustificationDto } from '../dto/review-justification.dto';
import { JustificationsService } from '../services/justifications.service';

@ApiTags('Attendance Justifications')
@ApiBearerAuth()
@Controller('attendance/justifications')
export class JustificationsController {
  constructor(private readonly justificationsService: JustificationsService) {}

  @Post()
  @Permissions(PERMISSIONS.ATTENDANCE_JUSTIFY)
  @ApiOperation({ summary: 'Registrar justificación de ausencia' })
  create(@Body() dto: CreateJustificationDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.justificationsService.createJustification(dto, actor);
  }

  @Post(':id/evidence')
  @Permissions(PERMISSIONS.ATTENDANCE_JUSTIFY)
  @ApiOperation({ summary: 'Subir evidencia de justificación' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadEvidence(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile(
      new ParseFilePipeBuilder().addMaxSizeValidator({ maxSize: 10 * 1024 * 1024 }).build({
        fileIsRequired: true,
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.justificationsService.uploadEvidence(id, file, actor);
  }

  @Get('justifiable-absences')
  @Permissions(PERMISSIONS.ATTENDANCE_READ)
  @ApiOperation({ summary: 'Ausencias candidatas a justificación (WF-39)' })
  listJustifiableAbsences(
    @Query() query: JustifiableAbsencesQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.justificationsService.getJustifiableAbsences(query, actor);
  }

  @Get()
  @Permissions(PERMISSIONS.ATTENDANCE_READ)
  @ApiOperation({ summary: 'Listar justificaciones con filtros' })
  list(@Query() query: ListJustificationsQueryDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.justificationsService.getJustifications(query, actor);
  }

  @Patch(':id/review')
  @Permissions(PERMISSIONS.ATTENDANCE_REVIEW)
  @ApiOperation({ summary: 'Aprobar o rechazar justificación' })
  review(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewJustificationDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.justificationsService.reviewJustification(id, dto, actor);
  }
}
