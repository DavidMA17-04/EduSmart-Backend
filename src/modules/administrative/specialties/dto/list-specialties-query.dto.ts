import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { SpecialtyKind } from '../../../../common/enums/specialty-kind.enum';

export class ListSpecialtiesQueryDto {
  @ApiPropertyOptional({ enum: SpecialtyKind })
  @IsOptional()
  @IsEnum(SpecialtyKind)
  kind?: SpecialtyKind;
}
