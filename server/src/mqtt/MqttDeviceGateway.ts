import { DeviceService, SensorReading, SwitchCommandPort } from '../domain/DeviceService';
import { findSwitchById, sensors, switches } from '../domain/devices';
import { MqttClient } from './MqttClient';
import { sensorPayloadSchema, switchPayloadSchema } from './payloads';
import logger from '../logger';

/**
 * Translates between the broker and the domain: parses inbound device payloads
 * into readings, and turns outbound switch commands into published messages.
 */
export class MqttDeviceGateway implements SwitchCommandPort {

  constructor(private mqttClient: MqttClient) {}

  /**
   * Subscribes to every configured device topic. Called after the broker
   * connects, once the DeviceService exists (which needs this gateway as its
   * command port, hence the two-step wiring).
   */
  public start(deviceService: DeviceService): void {
    sensors.forEach((sensor) => {
      this.mqttClient.subscribeToTopic(sensor.statusTopic, (message) => {
        const reading = this.parseSensorPayload(sensor.statusTopic, message);
        if (reading) {
          deviceService.applySensorReading(sensor.id, reading);
        }
      });
    });
    switches.forEach((switchConfig) => {
      this.mqttClient.subscribeToTopic(switchConfig.stateTopic, (message) => {
        const payload = switchPayloadSchema.safeParse(message);
        if (!payload.success) {
          logger.error(`Ignoring unexpected state on topic ${switchConfig.stateTopic}: ${message}`);
          return;
        }
        deviceService.applySwitchState(switchConfig.id, payload.data === 'on');
      });
    });
  }

  public sendSwitchCommand(switchId: number, state: boolean): void {
    const switchConfig = findSwitchById(switchId);
    if (!switchConfig) {
      logger.error(`Cannot send command to unknown switch id ${switchId}`);
      return;
    }
    this.mqttClient.publishMessage(switchConfig.commandTopic, state ? 'on' : 'off');
  }

  private parseSensorPayload(topic: string, message: string): SensorReading | undefined {
    let json: unknown;
    try {
      json = JSON.parse(message);
    } catch {
      logger.error(`Ignoring malformed JSON on topic ${topic}: ${message}`);
      return undefined;
    }
    const payload = sensorPayloadSchema.safeParse(json);
    if (!payload.success) {
      logger.error(`Ignoring payload without numeric temperature/humidity on topic ${topic}: ${message}`);
      return undefined;
    }
    const { temperature, humidity, device_id } = payload.data;
    // Devices that do not report an id are identified by their topic instead.
    return { temperature, humidity, deviceId: device_id ?? topic };
  }
}
