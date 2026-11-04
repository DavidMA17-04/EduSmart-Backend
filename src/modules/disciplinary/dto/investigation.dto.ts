import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class InvestigationMessageDto {
  @ApiProperty({ minLength: 10, maxLength: 2000 })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  message!: string;
}

export class InformationResponseDto extends InvestigationMessageDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  requestEventId!: number;
}
