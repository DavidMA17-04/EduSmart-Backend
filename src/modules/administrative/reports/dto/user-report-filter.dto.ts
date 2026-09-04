import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { UserStatus } from '../../../../common/enums/user-status.enum';

export class UserReportFilterDto {
  @ApiPropertyOptional({
    example: 'Carlos',
    description:
      'Búsqueda sobre cédula, nombre, apellidos o correo. Case-insensitive según collation.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed === '' ? undefined : trimmed;
    }
    return value;
  })
  @IsString()
  @MaxLength(255)
  search?: string;

  @ApiPropertyOptional({ example: 2, description: 'ID del rol institucional' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    return typeof value === 'number' ? value : Number(value);
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  roleId?: number;

  @ApiPropertyOptional({ enum: UserStatus, example: UserStatus.ACTIVE })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    return typeof value === 'string' ? value.trim() : value;
  })
  @IsEnum(UserStatus)
  status?: UserStatus;
}
