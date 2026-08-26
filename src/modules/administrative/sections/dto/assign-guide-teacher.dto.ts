import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional } from 'class-validator';

export class AssignGuideTeacherDto {
  @ApiPropertyOptional({
    type: Number,
    example: 1,
    description: 'ID numérico del docente guía. Envíe null para quitar la asignación.',
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  guideTeacherId?: number | null;
}
