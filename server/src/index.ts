import express from 'express';
import bodyParser from 'body-parser';
import { createServer } from 'http';

import { setupRestEndpoints } from './api';
import { MqttService } from "./mqtt-service";
import { SensorDataService } from "./sensor-data-service";

const app = express();
app.use(bodyParser.json());
setupRestEndpoints(app);

const mqttClientService = new MqttService();
const sensorDataService = new SensorDataService(mqttClientService);

const PORT = process.env.PORT || 3000;
const httpServer = createServer(app);
httpServer.listen(PORT, () => {
  console.log(`[Server] Listening on port ${PORT}`);
});
mqttClientService.connectToBroker(() => {
  console.log('Registering MQTT topics');
  sensorDataService.registerMqttTopics();
});