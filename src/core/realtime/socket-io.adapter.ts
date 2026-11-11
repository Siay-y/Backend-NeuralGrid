import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { IncomingMessage } from 'node:http';
import type { Server, ServerOptions } from 'socket.io';

const COMPRESSION_THRESHOLD_BYTES = 1024;

export interface SocketIoSettings {
  allowedOrigins: string[];
}

export class AppSocketIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly settings: SocketIoSettings,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const allowed = new Set(this.settings.allowedOrigins);

    return super.createIOServer(port, {
      ...(options as ServerOptions),
      serveClient: false,
      maxHttpBufferSize: 16 * 1024,
      perMessageDeflate: { threshold: COMPRESSION_THRESHOLD_BYTES },
      pingInterval: 25_000,
      pingTimeout: 20_000,
      cors: { origin: this.settings.allowedOrigins, credentials: false },
      // The CORS option only covers HTTP long polling; the WebSocket upgrade is
      // not subject to CORS, so the Origin header is checked here for both.
      allowRequest: (request: IncomingMessage, callback) => {
        const origin = request.headers.origin;
        callback(null, typeof origin === 'string' && allowed.has(origin));
      },
    });
  }
}
