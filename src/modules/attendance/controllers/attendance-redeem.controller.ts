import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { RedeemAttendanceCodeDto } from '../dto/redeem-attendance-code.dto';
import { AttendanceTokenService } from '../services/attendance-token.service';

@ApiTags('attendance')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceRedeemController {
  constructor(private readonly tokens: AttendanceTokenService) {}

  @Post('redeem')
  @Roles(Role.STUDENT)
  redeem(
    @Body() dto: RedeemAttendanceCodeDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.tokens.redeemToken({ code: dto.code }, actor);
  }
}
