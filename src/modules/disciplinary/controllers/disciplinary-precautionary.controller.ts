import { Body, Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { OrderPrecautionaryDto } from '../dto/precautionary.dto';
import { DisciplinaryPrecautionaryService } from '../services/disciplinary-precautionary.service';

@ApiTags('Disciplinary - Retiro precautorio')
@ApiBearerAuth()
@Controller('disciplinary')
export class DisciplinaryPrecautionaryController {
  constructor(private readonly precautionary: DisciplinaryPrecautionaryService) {}

  @Post('cases/:id/precautionary-measures')
  @Permissions(PERMISSIONS.DISCIPLINARY_PRECAUTIONARY)
  @ApiOperation({ summary: 'Ordenar el retiro precautorio, hasta 10 días naturales, sin afectar la nota' })
  order(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: OrderPrecautionaryDto,
  ) {
    return this.precautionary.order(actor, id, dto);
  }
}
