import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { RecipientType } from '../entities/communication-recipient.entity';

export class CommunicationTargetDto {
  @ApiProperty({ enum: RecipientType, example: RecipientType.ALL })
  @IsEnum(RecipientType)
  recipientType!: RecipientType;

  @ApiPropertyOptional({ example: '1' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetId?: string;
}

export class AudienceEstimateDto {
  @ApiProperty({ type: [CommunicationTargetDto] })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CommunicationTargetDto)
  recipients!: CommunicationTargetDto[];
}
