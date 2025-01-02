// server/src/mqttClient.ts
import mqtt from 'mqtt';
import brokerConfig from './config/broker-config.json';
import { Server as SocketIOServer } from 'socket.io';
import { SensorData, addSensorData } from './sensorDataService';

const options = {
  username: brokerConfig.username,
  password: brokerConfig.password,
};
const MQTT_BROKER_URL = brokerConfig.host + ':' + brokerConfig.port;
const mqttClient = mqtt.connect(MQTT_BROKER_URL, options);

export function setupMqttClient(io: SocketIOServer) {
  mqttClient.on('connect', () => {
    console.log(`[MQTT] Connected to broker at ${MQTT_BROKER_URL}`);

    const topicToSubscribe = 'devices/livingroom/sensors/status';
    mqttClient.subscribe(topicToSubscribe, (err) => {
      if (err) {
        console.error(`[MQTT] Subscription error: ${err}`);
      } else {
        console.log(`[MQTT] Subscribed to topic: ${topicToSubscribe}`);
      }
    });
  });

  mqttClient.on('message', (topic: string, message: Buffer) => {
    try {
      const parsed: any = JSON.parse(message.toString());
      const newData: SensorData = {
        timestamp: parsed.timestamp || Date.now(),
        value: parsed.value || 0,
      };

      addSensorData(newData);
      io.emit('newSensorData', newData);

      console.log(`[MQTT] Received message on topic "${topic}":`, newData);
    } catch (error) {
      console.error('[MQTT] Failed to process incoming message', error);
    }
  });
}

export function publishSensorData(data: SensorData) {
  mqttClient.publish('my/sensor/data', JSON.stringify(data));
}