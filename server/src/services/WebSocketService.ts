import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import logger from "../logger";

export type EmitEvent = 'switch' | 'sensor' | 'initial';
export type ReceiveEvent = 'updateSwitch';

export class WebSocketService {

  private io: SocketIOServer;

  constructor(httpServer: HttpServer) {
    this.io = new SocketIOServer(httpServer, {
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

  onConnection(callback: (socket: any) => void) {
    this.io.on('connection', callback);
  }

  onEvent(event: ReceiveEvent, callback: (data: any) => void) {
    this.io.on('connection', (socket) => {
      socket.on(event, callback);
    });
  }

  emit(event: EmitEvent, data: any) {
    this.io.emit(event, data);
  }
}