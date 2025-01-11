import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';

export type EventType = 'switch' | 'sensor' | 'initial';

export class WebSocketService {

  private io: SocketIOServer;

  constructor(httpServer: HttpServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: "*"
      }
    });
  }

  onConnection(callback: () => void, disconnectCallback?: () => void) {
    this.io.on('connection', (socket) => {
      console.log('WebSocket connection established');
      socket.on('disconnect', () => {
        console.log('WebSocket connection closed');
        if (disconnectCallback) {
          disconnectCallback();
        }
      });
      callback();
    });
  }

  emit(event: EventType, data: any) {
    this.io.emit(event, data);
  }
}