import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ValidateGuardianDto {
  @ApiProperty({ description: 'Cédula o ID interno del estudiante', example: '300000020' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Ingrese la cédula del estudiante.' })
  @MaxLength(30)
  studentIdentifier!: string;

  @ApiProperty({ description: 'Cédula del encargado presente en caseta', example: '300000030' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Ingrese la cédula del encargado.' })
  @MaxLength(30)
  guardianIdentifier!: string;
}
