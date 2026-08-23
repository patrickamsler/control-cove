import { SensorConfig, SwitchConfig } from '../config/devices';

// Small stand-in device lists so tests do not depend on the real
// sensor-config.json / switch-config.json contents.
export const testSensors: SensorConfig[] = [
  { id: 1, name: 'Test Livingroom', statusTopic: 'devices/livingroom/sensors/status' },
  { id: 2, name: 'Test Bathroom', statusTopic: 'devices/bathroom/sensors/status' },
];

export const testSwitches: SwitchConfig[] = [
  { id: 10, name: 'Test Lamp', commandTopic: 'shellies/lamp/relay/0/command', stateTopic: 'shellies/lamp/relay/0' },
  { id: 20, name: 'Test Fan', commandTopic: 'shellies/fan/relay/0/command', stateTopic: 'shellies/fan/relay/0' },
];

// Factory for vi.mock('../config/devices', ...) — mirrors the real module's exports.
export const devicesModuleMock = () => ({
  sensors: testSensors,
  switches: testSwitches,
  findSensorById: (id: number) => testSensors.find((s) => s.id === id),
  findSwitchById: (id: number) => testSwitches.find((s) => s.id === id),
});
