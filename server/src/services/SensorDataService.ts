import { MqttService } from "./MqttService";
import sensorConfig from '../config/sensor-config.json';
import switchConfig from '../config/light-config.json';
import { WebSocketService } from "./WebSocketService";

interface SensorData {
  device_id: String
  humidity: number
  temperature: number
}

interface SwitchData {
  device_id: String
  state: boolean
}

export class SensorDataService {

  private sensorDataStorage: Map<number, SensorData> = new Map();
  private switchDataStorage: Map<number, SwitchData> = new Map();

  constructor(
      private mqttService: MqttService,
      private webSocketService: WebSocketService
  ) {}

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
    sensorConfig.forEach((sensor) => {
      this.mqttService.subscribeToTopic(sensor.statusTopic, (message) => {
        const data = JSON.parse(message);
        this.updateSensorData(sensor.id, data);
      });
    });
    switchConfig.forEach((light) => {
      this.mqttService.subscribeToTopic(light.stateTopic, (message) => {
        const device_id = light.stateTopic.split('/')[1];
        const state = message == 'on';
        const data = {device_id, state};
        this.updateSwitchData(light.id, data);
      });
    })
  }
}