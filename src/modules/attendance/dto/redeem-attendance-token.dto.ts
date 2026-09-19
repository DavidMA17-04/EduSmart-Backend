import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

function normalizeCode({ value }: { value: unknown }) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim().toUpperCase();
  return trimmed === '' ? undefined : trimmed;
}

/** Accepts `token` and/or `code` (student UI alias). */
export class RedeemAttendanceTokenDto {
  @ApiPropertyOptional({ example: 'A7K9M2QX', minLength: 6, maxLength: 32 })
  @IsOptional()
  @Transform(normalizeCode)
  @IsString()
  @MinLength(6)
  @MaxLength(32)
  @Matches(/^[A-Z0-9]+$/)
  token?: string;

  @ApiPropertyOptional({ example: 'A7K9M2QX', minLength: 6, maxLength: 32 })
  @IsOptional()
  @Transform(normalizeCode)
  @IsString()
  @MinLength(6)
  @MaxLength(32)
  @Matches(/^[A-Z0-9]+$/)
  code?: string;
}

export function resolveRedeemToken(dto: RedeemAttendanceTokenDto): string {
  return (dto.token ?? dto.code ?? '').trim().toUpperCase();
}
