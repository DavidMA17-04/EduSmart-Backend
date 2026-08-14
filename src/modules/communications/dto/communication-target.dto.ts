import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class CommunicationTargetDto {
  @ApiProperty()
  @IsUUID()
  recipientId!: string;

  @ApiProperty({ example: 'SECTION' })
  @IsString()
  recipientType!: string;
}
