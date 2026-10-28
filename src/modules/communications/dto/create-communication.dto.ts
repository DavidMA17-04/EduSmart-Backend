import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CommunicationPriority, CommunicationStatus } from '../entities/communication.entity';
import { CommunicationTargetDto } from './communication-target.dto';

export class CreateCommunicationDto {
  @ApiProperty({ description: 'Título del comunicado', example: 'Aviso sobre entrega de reportes' })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title!: string;

  @ApiProperty({ description: 'Contenido completo del comunicado', example: 'Estimada comunidad estudiantil...' })
  @IsString()
  @MinLength(5)
  content!: string;

  @ApiPropertyOptional({ enum: CommunicationPriority, default: CommunicationPriority.NORMAL })
  @IsOptional()
  @IsEnum(CommunicationPriority)
  priority?: CommunicationPriority;

  @ApiPropertyOptional({ enum: CommunicationStatus, default: CommunicationStatus.DRAFT })
  @IsOptional()
  @IsEnum(CommunicationStatus)
  status?: CommunicationStatus;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiresAcknowledgment?: boolean;

  @ApiPropertyOptional({ example: '2026-10-26T10:00:00Z' })
  @IsOptional()
  @IsDateString()
  publishDate?: string;

  @ApiPropertyOptional({ example: '2026-11-15T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @ApiPropertyOptional({ type: [CommunicationTargetDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommunicationTargetDto)
  recipients?: CommunicationTargetDto[];
}
