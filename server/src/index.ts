import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import * as dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { DeviceService } from './domain/DeviceService';
import { MqttClient } from './mqtt/MqttClient';
import { MqttDeviceGateway } from './mqtt/MqttDeviceGateway';
import { WebSocketService } from './ws/WebSocketService';
import { registerWebSocketHandlers } from './ws/registerWebSocketHandlers';
import { createApiRouter } from './http/routes';
import { openApiDocument } from './http/openapi';
import logger from './logger';

const result = dotenv.config();
logger.info(`Environment variables loaded: ${Object.keys(result.parsed ?? {}).join(', ')}`);

const app = express();
const httpServer = createServer(app);

// The gateway is the domain's command port, and needs the service to push
// inbound readings into — so it is constructed first and started last.
const mqttClient = new MqttClient();
const mqttDeviceGateway = new MqttDeviceGateway(mqttClient);
const deviceService = new DeviceService(mqttDeviceGateway);
const webSocketService = new WebSocketService(httpServer);

const API_ROOT = '/api';
// In the Docker image the CRA build is copied to server/public, next to dist/.
const CLIENT_DIR = path.join(__dirname, '..', 'public');
app.use(cors());
app.use(express.json());
app.use(API_ROOT, createApiRouter(deviceService));
app.get('/api-docs.json', (req, res) => res.json(openApiDocument));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

// Registered last so /api and /api-docs keep winning. Absent in development,
// where CRA serves the client on its own port.
if (fs.existsSync(CLIENT_DIR)) {
  app.use(express.static(CLIENT_DIR));
  // Express 5 (path-to-regexp v8) has no bare '*' route; '/*splat' is the spelling.
  app.get('/*splat', (req, res) => res.sendFile(path.join(CLIENT_DIR, 'index.html')));
  logger.info(`[Server] Serving client build from ${CLIENT_DIR}`);
} else {
  logger.info(`[Server] No client build at ${CLIENT_DIR}; serving API only`);
}

const port = Number(process.env.HTTP_PORT) || 8080;
httpServer.listen(port, () => {
  logger.info(`[Server] Listening on port ${port}`);
});

mqttClient.connectToBroker(() => {
  logger.info('Registering MQTT topics and WebSocket events');
  mqttDeviceGateway.start(deviceService);
  registerWebSocketHandlers(webSocketService, deviceService);
});
