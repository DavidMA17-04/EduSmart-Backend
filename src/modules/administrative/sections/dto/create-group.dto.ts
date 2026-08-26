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
    description: 'ID del nivel o seccin al que pertenece el grupo',
  })
  @IsUUID('4')
  sectionId!: string;

  @ApiPropertyOptional({
    type: Number,
    example: 1,
    description: 'ID numérico del usuario asignado como docente guía',
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  guideTeacherId?: number | null;
}