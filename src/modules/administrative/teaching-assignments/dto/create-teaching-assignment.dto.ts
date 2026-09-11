import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Min,
  ValidateIf,
} from 'class-validator';
import { AcademicOfferingKind } from '../../../../common/enums/academic-offering-kind.enum';

export class CreateTeachingAssignmentDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  userId!: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  groupId!: number;

  @ApiProperty({ enum: AcademicOfferingKind })
  @IsEnum(AcademicOfferingKind)
  offeringKind!: AcademicOfferingKind;

  @ApiPropertyOptional({
    description: 'Required when offeringKind is SUBJECT',
  })
  @ValidateIf((dto: CreateTeachingAssignmentDto) => dto.offeringKind === AcademicOfferingKind.SUBJECT)
  @IsInt()
  @Min(1)
  subjectId?: number | null;

  @ApiPropertyOptional({
    description: 'Required when offeringKind is a specialty kind',
  })
  @ValidateIf(
    (dto: CreateTeachingAssignmentDto) =>
      dto.offeringKind === AcademicOfferingKind.EXPLORATORY_WORKSHOP ||
      dto.offeringKind === AcademicOfferingKind.TECHNICAL_SPECIALTY,
  )
  @IsInt()
  @Min(1)
  specialtyId?: number | null;

  @ApiPropertyOptional({
    description: 'Defaults to the group academic period when omitted',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  academicPeriodId?: number | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isGuideTeacher?: boolean;
}
