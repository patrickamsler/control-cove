import { Server as SocketIOServer } from 'socket.io';
import { getAllSensorData } from './sensorDataService';
import { Server as HttpServer } from 'http';

export function setupWebSocket(httpServer: HttpServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*"
    }
  });

  io.on('connection', (socket) => {
    console.log('[WebSocket] Client connected:', socket.id);

    // Optionally send the existing sensor data when a client connects
    socket.emit('initialData', getAllSensorData());

    socket.on('disconnect', () => {
      console.log('[WebSocket] Client disconnected:', socket.id);
    });
  });

  return io;
}