import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';

export class WebSocketService {

  private io: SocketIOServer;

  constructor(httpServer: HttpServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: "*"
      }
    });
  }

  onConnection(callback: (socket: any) => void) {
    this.io.on('connection', callback);
  }

  emit(event: string, data: any) {
    this.io.emit(event, data);
  }
}