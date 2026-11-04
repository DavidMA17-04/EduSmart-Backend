import { ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional, Min, ValidateIf } from 'class-validator';
import { AcademicOfferingKind } from '../../../../common/enums/academic-offering-kind.enum';
import { CreateTeachingAssignmentDto } from './create-teaching-assignment.dto';

export class UpdateTeachingAssignmentDto extends PartialType(
  OmitType(CreateTeachingAssignmentDto, ['userId', 'groupId'] as const),
) {
  @ApiPropertyOptional({ enum: AcademicOfferingKind })
  @IsOptional()
  @IsEnum(AcademicOfferingKind)
  offeringKind?: AcademicOfferingKind;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((dto: UpdateTeachingAssignmentDto) => dto.subjectId !== null)
  @IsInt()
  @Min(1)
  subjectId?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((dto: UpdateTeachingAssignmentDto) => dto.specialtyId !== null)
  @IsInt()
  @Min(1)
  specialtyId?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  academicPeriodId?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isGuideTeacher?: boolean;
}
