import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class AssignGuardianDto {
  @ApiProperty()
  @IsUUID()
  guardianId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  relationship?: string;
}
