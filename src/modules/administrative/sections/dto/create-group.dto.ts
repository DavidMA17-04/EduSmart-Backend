import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { GroupStatus } from '../../../../common/enums/group-status.enum';

export class CreateGroupDto {
  @ApiProperty({ example: '7-1', maxLength: 50 })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @ApiPropertyOptional({ example: 30, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  studentCount?: number;

  @ApiProperty({ description: 'ID del nivel al que pertenece la sección' })
  @Type(() => Number)
  @IsInt()
  sectionId!: number;

  @ApiPropertyOptional({
    description: 'ID del período académico. Si se omite se usa el del nivel.',
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
