// server/src/mqtt-client.ts
import mqtt from 'mqtt';
import brokerConfig from './config/broker-config.json';
import { SensorData, addSensorData } from './sensor-data-service';
import sensorConfig from './config/sensor-config.json';

const options = {
  username: brokerConfig.username,
  password: brokerConfig.password,
};
const MQTT_BROKER_URL = brokerConfig.host + ':' + brokerConfig.port;
const mqttClient = mqtt.connect(MQTT_BROKER_URL, options);

export function setupMqttClient() {
  mqttClient.on('connect', () => {
    console.log(`[MQTT] Connected to broker at ${MQTT_BROKER_URL}`);

    sensorConfig.forEach((sensor) => {
      mqttClient.subscribe(sensor.statusTopic, (err) => {
        if (err) {
          console.error(`[MQTT] Subscription error: ${err}`);
        } else {
          console.log(`[MQTT] Subscribed to topic: ${sensor.statusTopic}`);
        }
      });
    });
  });

  mqttClient.on('message', (topic: string, message: Buffer) => {
    try {
      const parsed: any = JSON.parse(message.toString());
      const newData: SensorData = {
        device_id: parsed.device_id || 'unknown',
        humidity: parsed.humidity || 0,
        temperature: parsed.temperature || 0,
      };

      addSensorData(topic, newData);
      console.log(`[MQTT] Received message on topic "${topic}":`, newData);
    } catch (error) {
      console.error('[MQTT] Failed to process incoming message', error);
    }
  });
}

export function publishSensorData(data: SensorData) {
  mqttClient.publish('my/sensor/data', JSON.stringify(data));
}