import express from 'express';
import bodyParser from 'body-parser';
import { createServer } from 'http';
import { setupRestEndpoints } from './api/api';
import { MqttService } from './services/mqtt-service';
import { SensorDataService } from './services/sensor-data-service';
import * as dotenv from 'dotenv';

const result = dotenv.config();
console.log('Environment variables loaded:', result.parsed);

const app = express();
app.use(bodyParser.json());
setupRestEndpoints(app);

const mqttClientService = new MqttService();
const sensorDataService = new SensorDataService(mqttClientService);

const PORT = process.env.PORT;
const httpServer = createServer(app);
httpServer.listen(PORT, () => {
  console.log(`[Server] Listening on port ${PORT}`);
});
mqttClientService.connectToBroker(() => {
  console.log('Registering MQTT topics');
  sensorDataService.registerMqttTopics();
});