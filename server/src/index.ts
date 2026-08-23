import express from 'express';
import cors from 'cors';
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
app.use(cors());
app.use(express.json());
app.use(API_ROOT, createApiRouter(deviceService));
app.get('/api-docs.json', (req, res) => res.json(openApiDocument));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

httpServer.listen(process.env.HTTP_PORT, () => {
  logger.info(`[Server] Listening on port ${process.env.HTTP_PORT}`);
});

mqttClient.connectToBroker(() => {
  logger.info('Registering MQTT topics and WebSocket events');
  mqttDeviceGateway.start(deviceService);
  registerWebSocketHandlers(webSocketService, deviceService);
});
