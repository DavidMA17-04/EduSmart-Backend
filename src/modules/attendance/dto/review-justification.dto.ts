import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { JustificationStatus } from '../../../common/enums/justification-status.enum';

/** Only terminal review outcomes are accepted on PATCH /review. */
export enum JustificationReviewDecision {
  APPROVED = JustificationStatus.APPROVED,
  REJECTED = JustificationStatus.REJECTED,
}

export class ReviewJustificationDto {
  @ApiProperty({ enum: JustificationReviewDecision })
  @IsEnum(JustificationReviewDecision)
  status!: JustificationReviewDecision;

  @ApiPropertyOptional({
    description: 'Required when status is REJECTED (enforced in service)',
  })
  @IsOptional()
  @IsString()
  decisionNotes?: string;
}
