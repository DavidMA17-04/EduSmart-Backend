import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';
import { AttendanceStatus } from '../../../common/enums/attendance-status.enum';

export class AttendanceRecordItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  studentUserId!: number;

  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;
}

export class UpsertAttendanceRecordsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AttendanceRecordItemDto)
  records!: AttendanceRecordItemDto[];
}
