import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { DeliveryMedium } from '../constants/disciplinary.enums';

export class RecordPhysicalDeliveryDto {
  @ApiProperty({ enum: DeliveryMedium })
  @IsEnum(DeliveryMedium)
  medium!: DeliveryMedium;

  @ApiProperty({ example: '2026-10-19' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  deliveredOn!: string;

  @ApiProperty({ minLength: 2, maxLength: 150 })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  receivedByName!: string;
}

export class PhysicalFormalCommunicationDto extends RecordPhysicalDeliveryDto {
  @ApiProperty({ minLength: 10, maxLength: 2000 })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  proposedAction!: string;
}
