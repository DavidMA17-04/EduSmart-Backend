import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, ValidateIf } from 'class-validator';

export class AssignGuideTeacherDto {
  @ApiPropertyOptional({
    description: 'ID del docente guía. Envíe null para quitar la asignación.',
    nullable: true,
  })
  @Transform(({ value }) => (value === '' ? null : value))
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  guideTeacherId?: number | null;
}
