import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class AssignGuideTeacherDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'ID del docente guía. Envíe null para quitar la asignación.',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('4')
  guideTeacherId?: string | null;
}
