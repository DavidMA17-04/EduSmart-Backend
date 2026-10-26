import { Controller, Get, Param, ParseEnumPipe, ParseIntPipe, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { requestClientMeta } from '../auth/utils/request-client-meta';
import { InboxNotificationsService } from './inbox-notifications.service';
import { InboxSource } from './inbox.constants';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly inbox: InboxNotificationsService) {}

  @Get('mine')
  @ApiOperation({ summary: 'Bandeja in-app pendiente del actor autenticado' })
  mine(@CurrentUser() actor: AuthenticatedUser) {
    return this.inbox.mine(actor);
  }

  @Post(':source/:id/read')
  @ApiOperation({ summary: 'Marcar leído un ítem de la bandeja (fuentes que lo soportan)' })
  markRead(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('source', new ParseEnumPipe(InboxSource)) source: InboxSource,
    @Param('id', ParseIntPipe) id: number,
    @Req() request: Request,
  ) {
    return this.inbox.markRead(actor, source, id, requestClientMeta(request));
  }
}
