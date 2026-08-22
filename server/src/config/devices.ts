import switchConfig from './switch-config.json';
import sensorConfig from './sensor-config.json';

export interface SwitchConfig {
  id: number;
  name: string;
  commandTopic: string;
  stateTopic: string;
}

export interface SensorConfig {
  id: number;
  name: string;
  statusTopic: string;
}

function validate(devices: { id: number; name: string }[], topicFields: string[], label: string): void {
  const seenIds = new Set<number>();
  devices.forEach((device) => {
    if (seenIds.has(device.id)) {
      throw new Error(`Duplicate ${label} id: ${device.id}`);
    }
    seenIds.add(device.id);
    topicFields.forEach((field) => {
      const value = (device as Record<string, unknown>)[field];
      if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`${label} "${device.name}" (id ${device.id}) has an empty ${field}`);
      }
    });
  });
}

validate(switchConfig, ['commandTopic', 'stateTopic'], 'switch');
validate(sensorConfig, ['statusTopic'], 'sensor');

export const switches: SwitchConfig[] = switchConfig;
export const sensors: SensorConfig[] = sensorConfig;

export function findSwitchById(id: number): SwitchConfig | undefined {
  return switches.find((s) => s.id === id);
}

export function findSensorById(id: number): SensorConfig | undefined {
  return sensors.find((s) => s.id === id);
}
