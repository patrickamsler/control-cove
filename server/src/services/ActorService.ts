import { MqttService } from "./MqttService";
import { WebSocketService } from "./WebSocketService";
import switchConfig from "../config/light-config.json";

interface SwitchData {
  id: number
  state: boolean
}

export class ActorService {

  constructor(
      private mqttService: MqttService,
      private webSocketService: WebSocketService
  ) {}

  public registerWebsocketEvents(): void {
    this.webSocketService.onEvent('switch', (data: SwitchData) => {
      console.log('Received switch event', data);
      this.emitSwitchMessage(data.id, data.state);
    })
  }

  private emitSwitchMessage = (switchId: number, state: boolean) => {
    const switchData = switchConfig.find((config) => config.id === switchId);
    if (switchData) {
      this.mqttService.publishMessage(switchData.commandTopic, state ? 'on' : 'off');
    }
  }
}