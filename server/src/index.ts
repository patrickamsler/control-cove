import express, { Router } from 'express';
import bodyParser from 'body-parser';
import { createServer } from 'http';
import { MqttService } from './services/MqttService';
import { SensorDataService } from './services/SensorDataService';
import * as dotenv from 'dotenv';
import { WebSocketService } from "./services/WebSocketService";
import { ActorService } from "./services/ActorService";
import { SensorDataController } from './controllers/SensorDataController';

const result = dotenv.config();
console.log('Environment variables loaded:', result.parsed);

const app = express();
const httpServer = createServer(app);
const mqttService = new MqttService();
const webSocketService = new WebSocketService(httpServer);
const sensorDataService = new SensorDataService(mqttService, webSocketService);
const actorService = new ActorService(mqttService, webSocketService);
const sensorDataController = new SensorDataController(sensorDataService);

const API_ROOT = '/api';
const router = Router();
router.get("/sensors", sensorDataController.getSensorData);
app.use(API_ROOT, router);
app.use(bodyParser.json());

const HTTP_PORT = process.env.HTTP_PORT;
httpServer.listen(HTTP_PORT, () => {
  console.log(`[Server] Listening on port ${HTTP_PORT}`);
});
mqttService.connectToBroker(() => {
  console.log('Registering MQTT topics and WebSocket events');
  sensorDataService.registerMqttTopics();
  sensorDataService.registerWebsocketEvents();
  actorService.registerWebsocketEvents();
});