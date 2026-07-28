import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';

let socketServer: Server | null = null;

export function createSocketServer(
  httpServer: HttpServer,
  isAllowedOrigin: (origin?: string | null) => boolean
) {
  if (socketServer) return socketServer;

  socketServer = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        callback(null, isAllowedOrigin(origin));
      },
      credentials: true,
    },
  });

  socketServer.on('connection', (socket) => {
    socket.on('join-church', (churchId: number | string) => {
      socket.join(`church:${churchId}`);
    });

    socket.on('join-live-room', (churchId: number | string) => {
      socket.join(`live:${churchId}`);
    });

    socket.on('disconnect', () => {
      // no-op
    });
  });

  return socketServer;
}

export const io = new Proxy({} as Server, {
  get(_target, prop) {
    if (!socketServer) {
      throw new Error('Socket server has not been initialized');
    }
    return (socketServer as unknown as Record<string, unknown>)[prop as string];
  },
});
