import { forwardRef, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PERMISSIONS } from '../../common/constants/permissions.constant';
import { INSTITUTIONAL_ROLE_ADMIN } from '../../common/constants/institutional-roles.constant';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AuthService } from '../auth/services/auth.service';
import { SessionsService } from '../auth/services/sessions.service';
import {
  REALTIME_ROOM,
  REALTIME_USER_ROOM,
  type RealtimeEvent,
} from './realtime.types';

type AuthedSocket = Socket & {
  data: {
    userId?: number;
    sessionId?: number;
  };
};

@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: true, credentials: true },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => AuthService)) private readonly auth: AuthService,
    @Inject(forwardRef(() => SessionsService))
    private readonly sessions: SessionsService,
  ) {}

  async handleConnection(client: AuthedSocket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.disconnect(true);
        return;
      }
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.get<string>('jwt.secret') ?? 'changeme',
      });
      const user = await this.auth.validateUserById(Number(payload.sub));
      if (!user) {
        client.disconnect(true);
        return;
      }
      if (payload.sid) {
        const active = await this.sessions.isActive(payload.sid, user.id);
        if (!active) {
          client.disconnect(true);
          return;
        }
        client.data.sessionId = payload.sid;
      }
      client.data.userId = user.id;
      await client.join(REALTIME_USER_ROOM(user.id));
      const roles = (user.roles ?? []).map(String);
      const permissions = user.permissions ?? [];
      const isAdmin =
        roles.includes(Role.ADMIN) || roles.includes(INSTITUTIONAL_ROLE_ADMIN);
      if (isAdmin || permissions.includes(PERMISSIONS.ATTENDANCE_READ)) {
        await client.join(REALTIME_ROOM.STAFF_ATTENDANCE);
      }
      if (isAdmin || permissions.includes(PERMISSIONS.ATTENDANCE_REVIEW)) {
        await client.join(REALTIME_ROOM.STAFF_ATTENDANCE_REVIEW);
      }
    } catch (error) {
      this.logger.debug(
        `Conexión realtime rechazada: ${
          error instanceof Error ? error.message : 'token inválido'
        }`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthedSocket): void {
    // Socket.IO limpia rooms al desconectar; no-op intencional.
    void client;
  }

  emitToUser(userId: number, event: RealtimeEvent): void {
    this.server.to(REALTIME_USER_ROOM(userId)).emit('event', event);
  }

  emitToRoom(room: string, event: RealtimeEvent): void {
    this.server.to(room).emit('event', event);
  }

  disconnectUser(userId: number, sessionId?: number): void {
    const room = REALTIME_USER_ROOM(userId);
    void this.server
      .in(room)
      .fetchSockets()
      .then((sockets) => {
        for (const socket of sockets) {
          const authed = socket as unknown as AuthedSocket;
          if (sessionId != null && authed.data.sessionId !== sessionId) continue;
          authed.emit('event', {
            type: 'session.revoked',
            at: new Date().toISOString(),
            sessionId,
          } satisfies RealtimeEvent);
          authed.disconnect(true);
        }
      })
      .catch((error: unknown) => {
        this.logger.warn(
          `No se pudieron desconectar sockets de user:${userId}: ${
            error instanceof Error ? error.message : 'error'
          }`,
        );
      });
  }

  private extractToken(client: Socket): string | null {
    const fromAuth = (client.handshake.auth as { token?: string } | undefined)?.token;
    if (fromAuth?.trim()) return fromAuth.trim();
    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.toLowerCase().startsWith('bearer ')) {
      return header.slice(7).trim();
    }
    const queryToken = client.handshake.query.token;
    if (typeof queryToken === 'string' && queryToken.trim()) return queryToken.trim();
    return null;
  }
}
