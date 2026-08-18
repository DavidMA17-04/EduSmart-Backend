import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateGroupDto {
  @ApiProperty({ example: '9-1', maxLength: 50 })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @ApiPropertyOptional({ example: 30, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  studentCount?: number;

  @ApiProperty({
    format: 'uuid',
    description: 'ID del nivel o secci�n al que pertenece el grupo',
  })
  @IsUUID('4')
  sectionId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'ID del usuario asignado como docente gu�a',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('4')
  guideTeacherId?: string | null;
}