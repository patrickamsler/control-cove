import { MqttService } from "./MqttService";
import { sensors, switches } from '../config/devices';
import { WebSocketService } from "./WebSocketService";
import logger from '../logger';

export interface SensorData {
  device_id: string
  humidity: number
  temperature: number
}

export interface SwitchData {
  device_id: string
  state: boolean
}

const parseSensorPayload = (topic: string, message: string): SensorData | undefined => {
  let payload: unknown;
  try {
    payload = JSON.parse(message);
  } catch (error) {
    logger.error(`Ignoring malformed JSON on topic ${topic}: ${message}`);
    return undefined;
  }
  if (typeof payload !== 'object' || payload === null) {
    logger.error(`Ignoring non-object payload on topic ${topic}: ${message}`);
    return undefined;
  }
  const { device_id, temperature, humidity } = payload as Record<string, unknown>;
  if (typeof temperature !== 'number' || typeof humidity !== 'number') {
    logger.error(`Ignoring payload without numeric temperature/humidity on topic ${topic}: ${message}`);
    return undefined;
  }
  return { device_id: typeof device_id === 'string' ? device_id : topic, temperature, humidity };
};

export class SensorDataService {

  private sensorDataStorage: Map<number, SensorData> = new Map();
  private switchDataStorage: Map<number, SwitchData> = new Map();

  constructor(
      private mqttService: MqttService,
      private webSocketService: WebSocketService
  ) {}

  public getSensorData(id: number): SensorData | undefined {
    return this.sensorDataStorage.get(id);
  }

  public getSwitchData(id: number): SwitchData | undefined {
    return this.switchDataStorage.get(id);
  }

  private updateSensorData(sensorId: number, data: SensorData): void {
    this.sensorDataStorage.set(sensorId, data);
    this.webSocketService.emit('sensor', {id: sensorId, data});
  }

  private updateSwitchData(switchId: number, data: SwitchData): void {
    this.switchDataStorage.set(switchId, data);
    this.webSocketService.emit('switch', {id: switchId, data});
  }

  public registerWebsocketEvents(): void {
    this.webSocketService.onConnection((socket) => {
      const initialSensorData = Array.from(this.sensorDataStorage.entries()).map(([id, data]) => ({id, data}));
      const initialSwitchData = Array.from(this.switchDataStorage.entries()).map(([id, data]) => ({id, data}));
      const initialData = {sensors: initialSensorData, switches: initialSwitchData};
      socket.emit('initial', initialData);
    });
  }

  public registerMqttTopics(): void {
    sensors.forEach((sensor) => {
      this.mqttService.subscribeToTopic(sensor.statusTopic, (message) => {
        const data = parseSensorPayload(sensor.statusTopic, message);
        if (data) {
          this.updateSensorData(sensor.id, data);
        }
      });
    });
    switches.forEach((switchConfig) => {
      this.mqttService.subscribeToTopic(switchConfig.stateTopic, (message) => {
        const device_id = switchConfig.stateTopic.split('/')[1];
        const state = message == 'on'; // TODO in case of other values, we might want to log a warning and ignore the message
        const data = {device_id, state};
        this.updateSwitchData(switchConfig.id, data);
      });
    })
  }
}