import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseFilePipeBuilder,
  ParseIntPipe,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { SkipResponseWrap } from '../../../common/decorators/skip-response-wrap.decorator';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { EVIDENCE_MAX_BYTES } from '../services/evidence-file';
import { DisciplinaryEvidenceService } from '../services/disciplinary-evidence.service';

@ApiTags('Disciplinary - Evidencias')
@ApiBearerAuth()
@Controller('disciplinary/cases')
export class DisciplinaryEvidenceController {
  constructor(private readonly evidences: DisciplinaryEvidenceService) {}

  @Post(':caseId/evidences')
  @Permissions(PERMISSIONS.DISCIPLINARY_CREATE)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Adjuntar una evidencia PDF, JPG o PNG al expediente' })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: EVIDENCE_MAX_BYTES } }))
  upload(
    @Param('caseId', ParseIntPipe) caseId: number,
    @UploadedFile(
      new ParseFilePipeBuilder().addMaxSizeValidator({ maxSize: EVIDENCE_MAX_BYTES }).build({
        fileIsRequired: true,
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.evidences.upload(caseId, file, actor);
  }

  @Get(':caseId/evidences/:evidenceId/file')
  @SkipResponseWrap()
  @ApiOperation({ summary: 'Descargar una evidencia si el actor puede ver el expediente' })
  download(
    @Param('caseId', ParseIntPipe) caseId: number,
    @Param('evidenceId', ParseIntPipe) evidenceId: number,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<StreamableFile> {
    return this.evidences.download(caseId, evidenceId, actor);
  }
}
