import express from 'express';
import bodyParser from 'body-parser';
import { createServer } from 'http';

import { setupMqttClient } from "./mqttClient";
import { setupRestEndpoints } from './api';
import { setupWebSocket } from './webSocket';

const app = express();
app.use(bodyParser.json());
const httpServer = createServer(app);
const io = setupWebSocket(httpServer);
setupMqttClient();
setupRestEndpoints(app);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`[Server] Listening on port ${PORT}`);
});