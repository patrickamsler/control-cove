import { EventEmitter } from 'events';
import { SensorDto, SwitchDto } from '@control-cove/shared';
import { findSensorById, findSwitchById, sensors, switches } from './devices';
import logger from '../logger';

/**
 * How the domain reaches the devices. Implemented by the MQTT layer so that
 * DeviceService itself stays free of any transport.
 */
export interface SwitchCommandPort {
  sendSwitchCommand(switchId: number, state: boolean): void;
}

export interface SensorReading {
  temperature: number;
  humidity: number;
  /**
   * The identifier the device reports for itself. Server-internal: it is stored
   * for logging and for the planned MCP layer, but is not part of SensorDto and
   * never reaches the browser. Absent if the device did not send one.
   */
  deviceId?: string;
}

/**
 * The layer the HTTP, WebSocket and (later) MCP adapters all sit on top of.
 *
 * Device identity and names come from the static config; the live values are
 * kept in memory only, so they are empty after a restart until devices publish
 * again. Unknown values stay *absent* from the DTOs rather than being nulled.
 */
export class DeviceService {

  private switchStates = new Map<number, boolean>();
  private sensorReadings = new Map<number, SensorReading>();
  private events = new EventEmitter();

  constructor(private commands: SwitchCommandPort) {
    // The MCP layer adds a short-lived listener per in-flight set_switch call, so
    // the default cap of 10 would produce spurious leak warnings under concurrency.
    this.events.setMaxListeners(0);
  }

  public getSwitches(): SwitchDto[] {
    return switches.map((config) => this.toSwitchDto(config.id, config.name));
  }

  public getSensors(): SensorDto[] {
    return sensors.map((config) => this.toSensorDto(config.id, config.name));
  }

  public getSwitch(id: number): SwitchDto | undefined {
    const config = findSwitchById(id);
    return config && this.toSwitchDto(config.id, config.name);
  }

  public getSensor(id: number): SensorDto | undefined {
    const config = findSensorById(id);
    return config && this.toSensorDto(config.id, config.name);
  }

  /** The full internal reading, including the fields kept off the DTO. */
  public getSensorReading(id: number): SensorReading | undefined {
    return this.sensorReadings.get(id);
  }

  /** Requests a new state for a switch. The state map is only updated once the device reports back. */
  public setSwitch(id: number, state: boolean): void {
    if (!findSwitchById(id)) {
      logger.error(`Ignoring state change for unknown switch id ${id}`);
      return;
    }
    this.commands.sendSwitchCommand(id, state);
  }

  /** Inbound: a switch reported its state. */
  public applySwitchState(id: number, state: boolean): void {
    const config = findSwitchById(id);
    if (!config) {
      logger.error(`Ignoring state report for unknown switch id ${id}`);
      return;
    }
    this.switchStates.set(id, state);
    this.events.emit('switch', this.toSwitchDto(config.id, config.name));
  }

  /** Inbound: a sensor reported a reading. */
  public applySensorReading(id: number, reading: SensorReading): void {
    const config = findSensorById(id);
    if (!config) {
      logger.error(`Ignoring reading for unknown sensor id ${id}`);
      return;
    }
    this.sensorReadings.set(id, reading);
    this.events.emit('sensor', this.toSensorDto(config.id, config.name));
  }

  /** Returns a disposer; callers that subscribe for the lifetime of the process can ignore it. */
  public onSwitchChanged(callback: (data: SwitchDto) => void): () => void {
    this.events.on('switch', callback);
    return () => {
      this.events.off('switch', callback);
    };
  }

  /** Returns a disposer; callers that subscribe for the lifetime of the process can ignore it. */
  public onSensorChanged(callback: (data: SensorDto) => void): () => void {
    this.events.on('sensor', callback);
    return () => {
      this.events.off('sensor', callback);
    };
  }

  private toSwitchDto(id: number, name: string): SwitchDto {
    const state = this.switchStates.get(id);
    return state === undefined ? { id, name } : { id, name, state };
  }

  private toSensorDto(id: number, name: string): SensorDto {
    const reading = this.sensorReadings.get(id);
    if (reading === undefined) {
      return { id, name };
    }
    // deviceId is intentionally dropped here — it stays server-internal.
    return { id, name, temperature: reading.temperature, humidity: reading.humidity };
  }
}
