import express from 'express';
import bodyParser from 'body-parser';
import { createServer } from 'http';
import { MqttService } from './services/mqtt-service';
import { SensorDataService } from './services/sensor-data-service';
import * as dotenv from 'dotenv';
import configRoutes from "./routes/config-routes";

const result = dotenv.config();
console.log('Environment variables loaded:', result.parsed);

const API_ROOT = '/api';
const app = express();
app.use(bodyParser.json());
app.use(API_ROOT, configRoutes);

const mqttClientService = new MqttService();
const sensorDataService = new SensorDataService(mqttClientService);

const HTTP_PORT = process.env.HTTP_PORT;
const httpServer = createServer(app);
httpServer.listen(HTTP_PORT, () => {
  console.log(`[Server] Listening on port ${HTTP_PORT}`);
});
mqttClientService.connectToBroker(() => {
  console.log('Registering MQTT topics');
  sensorDataService.registerMqttTopics();
});