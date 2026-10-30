import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

function normalizeCode({ value }: { value: unknown }) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim().toUpperCase();
  return trimmed === '' ? undefined : trimmed;
}

/** Public redeem contract: `{ code }` is required. Extra ids are not part of the DTO. */
export class RedeemAttendanceCodeDto {
  @ApiProperty({ example: 'A7K9M2QX', minLength: 6, maxLength: 32 })
  @Transform(normalizeCode)
  @IsString()
  @MinLength(6)
  @MaxLength(32)
  @Matches(/^[A-Z0-9]+$/)
  code!: string;
}
