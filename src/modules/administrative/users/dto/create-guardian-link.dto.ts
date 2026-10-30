import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateGuardianLinkDto {
  @ApiProperty({ example: 42, description: 'id_users de la contraparte (Encargado o Estudiante)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  counterpartUserId!: number;

  @ApiPropertyOptional({ example: 'Madre', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  relationship?: string;
}
