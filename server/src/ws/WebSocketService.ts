import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { ClientToServerEvents, ServerToClientEvents } from '@control-cove/shared';
import logger from '../logger';

export type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/**
 * Thin socket.io wrapper. The event maps come from the shared package, so the
 * event names and payload shapes are checked against the client at compile time.
 */
export class WebSocketService {

  private io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

  constructor(httpServer: HttpServer) {
    this.io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
      cors: {
        origin: "*"
      }
    });
    this.io.on('connection', (socket) => {
      logger.info(`A client connected with ID: ${socket.id}`);
      socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
      });
    });
  }

  onConnection(callback: (socket: AppSocket) => void) {
    this.io.on('connection', callback);
  }

  onEvent<E extends keyof ClientToServerEvents>(event: E, callback: ClientToServerEvents[E]) {
    this.io.on('connection', (socket) => {
      // socket.io cannot narrow its listener type through the generic E; the
      // public signature above is what callers are checked against.
      socket.on(event as any, callback as any);
    });
  }

  emit<E extends keyof ServerToClientEvents>(event: E, ...data: Parameters<ServerToClientEvents[E]>) {
    this.io.emit(event, ...data);
  }
}
