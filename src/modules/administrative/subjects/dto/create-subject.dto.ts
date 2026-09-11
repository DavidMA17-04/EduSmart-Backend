import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SubjectStatus } from '../../../../common/enums/subject-status.enum';

export class CreateSubjectDto {
  @ApiProperty({ example: 'Matemáticas', maxLength: 150 })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({ example: 'MAT-01', maxLength: 30 })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  code?: string | null;

  @ApiPropertyOptional({ enum: SubjectStatus, default: SubjectStatus.ACTIVE })
  @IsOptional()
  @IsEnum(SubjectStatus)
  status?: SubjectStatus;
}
