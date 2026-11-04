import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class OrderPrecautionaryDto {
  @ApiProperty({ example: '2026-10-19' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startsOn!: string;

  @ApiProperty({ example: '2026-10-25' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endsOn!: string;

  @ApiProperty({ minLength: 10, maxLength: 2000 })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason!: string;

  @ApiProperty()
  @IsBoolean()
  paniCoordination!: boolean;
}
