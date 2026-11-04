import { Controller, Delete, HttpCode, HttpStatus, Param, ParseIntPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../../../common/constants/permissions.constant';
import { GuardianStudentLinksService } from '../services/guardian-student-links.service';

@ApiTags('Administrative - Users')
@ApiBearerAuth()
@Controller('guardian-links')
export class GuardianLinksController {
  constructor(private readonly service: GuardianStudentLinksService) {}

  @Delete(':linkId')
  @Permissions(PERMISSIONS.ADMINISTRATOR_EDIT)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Quitar vínculo Encargado ↔ Estudiante' })
  remove(@Param('linkId', ParseIntPipe) linkId: number) {
    return this.service.remove(linkId);
  }
}
