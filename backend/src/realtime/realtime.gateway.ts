import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:3000'];

// Real-time transport for the inbox. Each authenticated socket joins a room
// named after its tenant, so a workspace only ever receives its own events.
// The frontend connects through the same-origin Next.js proxy
// (path: /api/backend/socket.io) which satisfies the CSP connect-src policy.
@WebSocketGateway({
  cors: { origin: allowedOrigins, credentials: true },
  // Serve at exactly "/socket.io" (no trailing slash) so the request path
  // survives the Next.js rewrite proxy without slash normalisation. The
  // client sets the matching option.
  addTrailingSlash: false,
})
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(private readonly jwt: JwtService) {}

  handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');
      if (!token) {
        client.disconnect();
        return;
      }
      const payload = this.jwt.verify(token);
      const tenantId = payload?.tenantId;
      if (!tenantId) {
        client.disconnect();
        return;
      }
      client.data.tenantId = tenantId;
      client.data.userId = payload.sub;
      void client.join(`tenant:${tenantId}`);
    } catch {
      client.disconnect();
    }
  }

  // Broadcast a newly-persisted message to everyone viewing the workspace.
  emitNewMessage(tenantId: string, message: unknown) {
    if (!this.server) return;
    this.server.to(`tenant:${tenantId}`).emit('new_message', message);
  }
}
