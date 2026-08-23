import { beforeEach, describe, expect, it, vi } from 'vitest';

const validSwitches = [
  { id: 1, name: 'Kitchen', commandTopic: 'shellies/kitchen/relay/0/command', stateTopic: 'shellies/kitchen/relay/0' },
  { id: 2, name: 'Bedroom', commandTopic: 'shellies/bedroom/relay/0/command', stateTopic: 'shellies/bedroom/relay/0' },
];

const validSensors = [
  { id: 1, name: 'Livingroom', statusTopic: 'devices/livingroom/sensors/status' },
  { id: 2, name: 'Bathroom', statusTopic: 'devices/bathroom/sensors/status' },
];

// devices.ts validates at import time, so each case re-imports the module with mocked JSON.
const loadDevices = (switchConfig: unknown = validSwitches, sensorConfig: unknown = validSensors) => {
  vi.doMock('./switch-config.json', () => ({ default: switchConfig }));
  vi.doMock('./sensor-config.json', () => ({ default: sensorConfig }));
  return import('./devices');
};

beforeEach(() => {
  vi.resetModules();
  vi.doUnmock('./switch-config.json');
  vi.doUnmock('./sensor-config.json');
});

describe('devices config with a valid configuration', () => {
  it('exposes the configured switches and sensors', async () => {
    const { switches, sensors } = await loadDevices();

    expect(switches).toEqual(validSwitches);
    expect(sensors).toEqual(validSensors);
  });

  it('looks a switch up by id', async () => {
    const { findSwitchById } = await loadDevices();

    expect(findSwitchById(2)).toEqual(validSwitches[1]);
    expect(findSwitchById(999)).toBeUndefined();
  });

  it('looks a sensor up by id', async () => {
    const { findSensorById } = await loadDevices();

    expect(findSensorById(1)).toEqual(validSensors[0]);
    expect(findSensorById(999)).toBeUndefined();
  });

  it('accepts an empty device list', async () => {
    const { switches, sensors } = await loadDevices([], []);

    expect(switches).toEqual([]);
    expect(sensors).toEqual([]);
  });
});

describe('devices config validation', () => {
  it('rejects duplicate switch ids', async () => {
    await expect(loadDevices([...validSwitches, { ...validSwitches[0], name: 'Clone' }])).rejects.toThrow(
      'Duplicate switch id: 1'
    );
  });

  it('rejects duplicate sensor ids', async () => {
    await expect(loadDevices(validSwitches, [...validSensors, { ...validSensors[0], name: 'Clone' }])).rejects.toThrow(
      'Duplicate sensor id: 1'
    );
  });

  it.each(['commandTopic', 'stateTopic'])('rejects a switch with an empty %s', async (field) => {
    await expect(loadDevices([{ ...validSwitches[0], [field]: '' }])).rejects.toThrow(
      `switch "Kitchen" (id 1) ${field}`
    );
  });

  it.each(['commandTopic', 'stateTopic'])('rejects a switch with a whitespace-only %s', async (field) => {
    await expect(loadDevices([{ ...validSwitches[0], [field]: '   ' }])).rejects.toThrow(
      `switch "Kitchen" (id 1) ${field}`
    );
  });

  it.each(['commandTopic', 'stateTopic'])('rejects a switch with a missing %s', async (field) => {
    const { [field]: _omitted, ...incomplete } = validSwitches[0] as Record<string, unknown>;

    await expect(loadDevices([incomplete])).rejects.toThrow(`switch "Kitchen" (id 1) ${field}`);
  });

  it('rejects a sensor with an empty statusTopic', async () => {
    await expect(loadDevices(validSwitches, [{ ...validSensors[0], statusTopic: '' }])).rejects.toThrow(
      'sensor "Livingroom" (id 1) statusTopic'
    );
  });

  it('rejects a sensor with a non-string statusTopic', async () => {
    await expect(loadDevices(validSwitches, [{ ...validSensors[0], statusTopic: 42 }])).rejects.toThrow(
      'sensor "Livingroom" (id 1) statusTopic'
    );
  });

  it('rejects a switch with a non-integer id', async () => {
    await expect(loadDevices([{ ...validSwitches[0], id: 1.5 }])).rejects.toThrow(
      'switch "Kitchen" (id 1.5) id'
    );
  });
});

describe('the real device configuration shipped in the repo', () => {
  it('loads without a validation error', async () => {
    await expect(import('./devices')).resolves.toBeDefined();
  });
});
