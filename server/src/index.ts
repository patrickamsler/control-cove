import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import mqtt from 'mqtt';
import brokerConfig from './config/broker-config.json';

/**
 * Interface for sensor data.
 * This can be extended with more fields as needed.
 */
interface SensorData {
  timestamp: number;
  value: number;
}

// In-memory storage for sensor data
let sensorDataStorage: SensorData[] = [];

// 1. Create Express application
const app = express();
app.use(bodyParser.json());

// 2. Create HTTP Server (for Socket.IO)
const httpServer = createServer(app);

// 3. Create Socket.IO server
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*"
  }
});

/**
 * MQTT Client Setup
 */
const options = {
  username: brokerConfig.username,
  password: brokerConfig.password,
};
const MQTT_BROKER_URL = brokerConfig.host + ':' + brokerConfig.port;
const mqttClient = mqtt.connect(MQTT_BROKER_URL, options);

/**
 * Handle MQTT connection
 */
mqttClient.on('connect', () => {
  console.log(`[MQTT] Connected to broker at ${MQTT_BROKER_URL}`);

  // Subscribe to a topic to receive sensor data
  const topicToSubscribe = 'devices/livingroom/sensors/status';
  mqttClient.subscribe(topicToSubscribe, (err) => {
    if (err) {
      console.error(`[MQTT] Subscription error: ${err}`);
    } else {
      console.log(`[MQTT] Subscribed to topic: ${topicToSubscribe}`);
    }
  });
});

/**
 * Handle incoming MQTT messages
 */
mqttClient.on('message', (topic: string, message: Buffer) => {
  try {
    // Parse the incoming message
    const parsed: any = JSON.parse(message.toString());
    // Construct a new SensorData object
    const newData: SensorData = {
      timestamp: parsed.timestamp || Date.now(),
      value: parsed.value || 0,
    };

    // Store in in-memory storage
    sensorDataStorage.push(newData);

    // Emit to WebSocket clients
    io.emit('newSensorData', newData);

    console.log(`[MQTT] Received message on topic "${topic}":`, newData);
  } catch (error) {
    console.error('[MQTT] Failed to process incoming message', error);
  }
});

/**
 * REST Endpoints
 */

// GET endpoint to retrieve all sensor data
app.get('/api/sensorData', (req: Request, res: Response) => {
  return res.status(200).json(sensorDataStorage);
});

// POST endpoint to send new data to the MQTT broker
// Sample payload: { "timestamp": 1672531200, "value": 42 }
app.post('/api/sensorData', (req, res) => {
  const data: SensorData = req.body;

  try {
    // Publish to MQTT broker
    mqttClient.publish('my/sensor/data', JSON.stringify(data));

    // You may also want to store it locally to reflect the data immediately
    sensorDataStorage.push(data);

    // Notify all connected WebSocket clients
    io.emit('newSensorData', data);

    return res.status(200).json({ message: 'Data sent to MQTT broker', data });
  } catch (error) {
    console.error('[REST] Failed to publish data to broker:', error);
    return res.status(500).json({ message: 'Failed to publish data', error });
  }
});

/**
 * WebSocket Connection Handling
 */
io.on('connection', (socket) => {
  console.log('[WebSocket] Client connected:', socket.id);

  // Optionally send the existing sensor data when a client connects
  socket.emit('initialData', sensorDataStorage);

  socket.on('disconnect', () => {
    console.log('[WebSocket] Client disconnected:', socket.id);
  });
});

/**
 * Start the HTTP server
 */
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`[Server] Listening on port ${PORT}`);
});