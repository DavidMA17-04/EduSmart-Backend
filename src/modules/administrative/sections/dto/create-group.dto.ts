import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { GroupStatus } from '../../../../common/enums/group-status.enum';

export class CreateGroupDto {
  @ApiProperty({ example: '7-1', maxLength: 50 })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @ApiPropertyOptional({
    example: 0,
    default: 0,
    description:
      'Contador de inscritos. En creación de cascarón se fuerza a 0 (sin auto-promoción).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  studentCount?: number;

  @ApiProperty({
    example: 30,
    description: 'Cupo máximo obligatorio de la sección (cascarón vacío)',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  maxCapacity!: number;

  @ApiProperty({ description: 'ID del nivel al que pertenece la sección' })
  @Type(() => Number)
  @IsInt()
  sectionId!: number;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description:
      'Carrera Técnica u oferta opcional de la sección. Null si el nivel no aplica.',
  })
  @Transform(({ value }) => (value === '' ? null : value))
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  specialtyId?: number | null;

  @ApiPropertyOptional({
    description: 'ID del curso lectivo. Si se omite se usa el del nivel.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  academicPeriodId?: number;

  @ApiPropertyOptional({
    enum: GroupStatus,
    default: GroupStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(GroupStatus)
  status?: GroupStatus;

  @ApiPropertyOptional({
    description: 'ID del docente guía (se persiste en teaching_assignments)',
    nullable: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  guideTeacherId?: number | null;
}
