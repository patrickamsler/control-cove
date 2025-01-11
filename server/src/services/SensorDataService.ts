import { MqttService } from "./MqttService";
import sensorConfig from '../config/sensor-config.json';
import switchConfig from '../config/light-config.json';
import { WebSocketService } from "./WebSocketService";

interface SensorData {
  device_id: String
  humidity: Number
  temperature: Number
}

interface SwitchData {
  device_id: String
  state: String
}

export class SensorDataService {

  private sensorDataStorage: Map<number, SensorData> = new Map();
  private switchDataStorage: Map<number, SwitchData> = new Map();
  private mqttService: MqttService;
  private webSocketService: WebSocketService;

  constructor(mqttService: MqttService, webSocketService: WebSocketService) {
    this.mqttService = mqttService;
    this.webSocketService = webSocketService;
    this.webSocketService.onConnection(this.onWsConnection);
  }

  private updateSensorData(sensorId: number, data: SensorData): void {
    this.sensorDataStorage.set(sensorId, data);
  }

  private updateSwitchData(switchId: number, data: SwitchData): void {
    this.switchDataStorage.set(switchId, data);
  }

  private onWsConnection(socket: any) {
    console.log('WebSocket connection established');
    socket.on('disconnect', () => {
      console.log('WebSocket connection closed');
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
        const state = message ? 'ON' : 'OFF';
        const data = {device_id, state};
        this.updateSwitchData(light.id, data);
      });
    })
  }
}