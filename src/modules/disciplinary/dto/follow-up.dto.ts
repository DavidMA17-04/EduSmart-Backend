import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { FollowUpKind, FollowUpOutcome } from '../constants/disciplinary.enums';

export class CreateFollowUpDto {
  @ApiProperty({ enum: FollowUpKind })
  @IsEnum(FollowUpKind)
  kind!: FollowUpKind;

  @ApiProperty({ example: '2026-10-19' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  followedOn!: string;

  @ApiProperty({ minLength: 10, maxLength: 4000 })
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  participants?: string;

  @ApiPropertyOptional({ example: '2026-10-30' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  reviewOn?: string;
}

export class CloseFollowUpDto {
  @ApiProperty({ enum: [FollowUpOutcome.MET, FollowUpOutcome.UNMET] })
  @IsIn([FollowUpOutcome.MET, FollowUpOutcome.UNMET])
  outcome!: FollowUpOutcome.MET | FollowUpOutcome.UNMET;

  @ApiProperty({ minLength: 10, maxLength: 2000 })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  note!: string;
}
