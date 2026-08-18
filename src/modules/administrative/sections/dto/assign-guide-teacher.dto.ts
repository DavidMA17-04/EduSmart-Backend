import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class AssignGuideTeacherDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'ID del docente gu�a. Env�e null para quitar la asignaci�n.',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('4')
  guideTeacherId?: string | null;
}
