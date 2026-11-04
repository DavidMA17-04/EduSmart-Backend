import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { GroupEnrollmentStatus } from '../../../../common/enums/group-enrollment-status.enum';

export class ListGroupEnrollmentsQueryDto {
  @ApiProperty({ description: 'Group (UI sección) id', example: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  groupId!: number;

  @ApiPropertyOptional({ enum: GroupEnrollmentStatus })
  @IsOptional()
  @IsEnum(GroupEnrollmentStatus)
  status?: GroupEnrollmentStatus;
}
