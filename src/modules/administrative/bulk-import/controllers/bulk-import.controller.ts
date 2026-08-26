import {
  Body,
  Controller,
  HttpStatus,
  ParseFilePipeBuilder,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  ConfirmBulkImportDto,
  ConfirmBulkImportResponseDto,
  ValidateBulkImportResponseDto,
} from '../dto/bulk-import.dto';
import { BulkImportService } from '../services/bulk-import.service';

@ApiTags('Administrative - BulkImport')
@ApiBearerAuth()
@Controller()
export class BulkImportController {
  constructor(private readonly service: BulkImportService) {}

  @Post(['bulk-import/validate', 'admin/users/import/validate'])
  @ApiOperation({
    summary: 'Validar archivo Excel (.xlsx, .xls) o CSV sin persistir en BD',
    description:
      'Procesa el archivo binario subido, normaliza columnas y analiza duplicados y errores semánticos devolviendo las métricas KPIs, desglose de incidencias y el listado de filas para la vista previa (WF-15).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Archivo Excel (.xlsx, .xls) o CSV con el formato oficial',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Análisis y KPIs del archivo procesado exitosamente',
    type: ValidateBulkImportResponseDto,
  })
  @UseInterceptors(FileInterceptor('file'))
  async validateFile(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: 10 * 1024 * 1024 }) // Máximo 10 MB
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        }),
    )
    file: Express.Multer.File,
  ): Promise<ValidateBulkImportResponseDto> {
    return this.service.validateBulkFile(file.buffer);
  }

  @Post(['bulk-import/confirm', 'admin/users/import/confirm'])
  @ApiOperation({
    summary: 'Confirmar e insertar usuarios validados en BD con transacción atómica',
    description:
      'Inserta el lote de usuarios validados dentro de una transacción atómica TypeORM (QueryRunner) en MySQL asignando contraseña cifrada con bcrypt y estado ACTIVE.',
  })
  @ApiResponse({
    status: 201,
    description: 'Usuarios importados exitosamente',
    type: ConfirmBulkImportResponseDto,
  })
  async confirmImport(
    @Body() dto: ConfirmBulkImportDto,
  ): Promise<ConfirmBulkImportResponseDto> {
    return this.service.confirmImport(dto);
  }
}
