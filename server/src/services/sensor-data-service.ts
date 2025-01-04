import { MqttService } from "./mqtt-service";
import sensorConfig from '../config/sensor-config.json';
import switchConfig from '../config/light-config.json';

export interface SensorData {
  device_id: String
  humidity: Number
  temperature: Number
}

export interface SwitchData {
  device_id: String
  state: String
}

export class SensorDataService {

  private sensorDataStorage: Map<number, SensorData> = new Map();
  private switchDataStorage: Map<number, SwitchData> = new Map();
  private mqttService: MqttService;

  constructor(mqttService: MqttService) {
    this.mqttService = mqttService;
  }

  private updateSensorData(sensorId: number, data: SensorData): void {
    this.sensorDataStorage.set(sensorId, data);
  }

  private updateSwitchData(switchId: number, data: SwitchData): void {
    this.switchDataStorage.set(switchId, data);
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
        const state = message ? 'ON' : 'OFF';
        const data = {device_id, state};
        this.updateSwitchData(light.id, data);
      });
    })
  }
}