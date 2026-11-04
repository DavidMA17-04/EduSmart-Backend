import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class AssignPermissionsDto {
  @ApiProperty({
    type: [Number],
    description: 'Lista de IDs de permisos a asignar (reemplaza el set actual)',
    example: [1, 2, 3],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  permissionIds!: number[];
}
