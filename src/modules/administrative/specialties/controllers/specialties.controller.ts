import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseFilePipeBuilder,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { SpecialtyKind } from '../../../../common/enums/specialty-kind.enum';
import { CreateSpecialtyDto } from '../dto/create-specialty.dto';
import { ListSpecialtiesQueryDto } from '../dto/list-specialties-query.dto';
import { UpdateSpecialtyDto } from '../dto/update-specialty.dto';
import { SpecialtiesService } from '../services/specialties.service';
import { SpecialtyHubService } from '../services/specialty-hub.service';

@ApiTags('Administrative - Specialties')
@ApiBearerAuth()
@Controller('specialties')
export class SpecialtiesController {
  constructor(
    private readonly service: SpecialtiesService,
    private readonly hubService: SpecialtyHubService,
  ) {}

  @Get('hub-covers')
  @ApiOperation({ summary: 'Covers del hub de oferta académica' })
  listHubCovers() {
    return this.hubService.listCovers();
  }

  @Post('hub-covers/:kind')
  @ApiOperation({ summary: 'Subir imagen de cover del hub' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 3 * 1024 * 1024 },
    }),
  )
  uploadHubCover(
    @Param('kind', new ParseEnumPipe(SpecialtyKind)) kind: SpecialtyKind,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: 3 * 1024 * 1024 })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
    )
    file: Express.Multer.File,
  ) {
    return this.hubService.saveCover(kind, file);
  }

  @Delete('hub-covers/:kind')
  @ApiOperation({ summary: 'Quitar imagen de cover del hub' })
  clearHubCover(
    @Param('kind', new ParseEnumPipe(SpecialtyKind)) kind: SpecialtyKind,
  ) {
    return this.hubService.clearCover(kind);
  }

  @Post()
  @ApiOperation({ summary: 'Crear especialidad o taller' })
  create(@Body() dto: CreateSpecialtyDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar especialidades (filtro opcional por kind)' })
  findAll(@Query() query: ListSpecialtiesQueryDto) {
    return this.service.findAll(query.kind);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener especialidad por ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar especialidad' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSpecialtyDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Inactivar especialidad (eliminación lógica)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
