import express from 'express';
import bodyParser from 'body-parser';
import { createServer } from 'http';
import { MqttService } from './services/MqttService';
import { SensorDataService } from './services/SensorDataService';
import * as dotenv from 'dotenv';
import configRoutes from "./routes/ConfigRoutes";
import { WebSocketService } from "./services/WebSocketService";

const result = dotenv.config();
console.log('Environment variables loaded:', result.parsed);

const API_ROOT = '/api';
const app = express();
app.use(bodyParser.json());
app.use(API_ROOT, configRoutes);

const httpServer = createServer(app);
const mqttClientService = new MqttService();
const webSocketService = new WebSocketService(httpServer);
const sensorDataService = new SensorDataService(mqttClientService, webSocketService);

const HTTP_PORT = process.env.HTTP_PORT;
httpServer.listen(HTTP_PORT, () => {
  console.log(`[Server] Listening on port ${HTTP_PORT}`);
});
mqttClientService.connectToBroker(() => {
  console.log('Registering MQTT topics');
  sensorDataService.registerMqttTopics();
});