import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import type { RealtimeEvent, RealtimeEventType } from './realtime.types';

@Injectable()
export class RealtimePublisher {
  private readonly logger = new Logger(RealtimePublisher.name);

  constructor(
    @Inject(forwardRef(() => RealtimeGateway))
    private readonly gateway: RealtimeGateway,
  ) {}

  notifyUser(
    userId: number,
    type: RealtimeEventType,
    extra: Omit<RealtimeEvent, 'type' | 'at'> = {},
  ): void {
    try {
      this.gateway.emitToUser(userId, {
        type,
        at: new Date().toISOString(),
        ...extra,
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo empujar ${type} a user:${userId}: ${
          error instanceof Error ? error.message : 'error'
        }`,
      );
    }
  }

  inboxChanged(userId: number, unreadCount?: number): void {
    this.notifyUser(userId, 'inbox.changed', { unreadCount });
  }

  notifyRoom(
    room: string,
    type: RealtimeEventType,
    extra: Omit<RealtimeEvent, 'type' | 'at'> = {},
  ): void {
    try {
      this.gateway.emitToRoom(room, {
        type,
        at: new Date().toISOString(),
        ...extra,
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo empujar ${type} a ${room}: ${
          error instanceof Error ? error.message : 'error'
        }`,
      );
    }
  }

  sessionRevoked(userId: number, sessionId?: number): void {
    this.notifyUser(userId, 'session.revoked', { sessionId });
    this.gateway.disconnectUser(userId, sessionId);
  }
}
