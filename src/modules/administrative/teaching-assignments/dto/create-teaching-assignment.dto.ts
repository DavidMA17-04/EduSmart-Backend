import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
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

  @ApiPropertyOptional({
    description: 'Una sección. Usar groupIds para asignación múltiple.',
  })
  @ValidateIf((dto: CreateTeachingAssignmentDto) => !dto.groupIds?.length)
  @IsInt()
  @Min(1)
  groupId?: number;

  @ApiPropertyOptional({
    type: [Number],
    description: 'Múltiples secciones para asignación simultánea del mismo docente/oferta',
    example: [1, 2, 3],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  groupIds?: number[];

  @ApiProperty({ enum: AcademicOfferingKind })
  @IsEnum(AcademicOfferingKind)
  offeringKind!: AcademicOfferingKind;

  @ApiPropertyOptional({
    description: 'Required when offeringKind is SUBJECT',
  })
  @ValidateIf(
    (dto: CreateTeachingAssignmentDto) => dto.offeringKind === AcademicOfferingKind.SUBJECT,
  )
  @IsInt()
  @Min(1)
  subjectId?: number | null;

  @ApiPropertyOptional({
    description: 'Required when offeringKind is a specialty / Carrera Técnica kind',
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
    description: 'Defaults to the group academic period (curso lectivo) when omitted',
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
