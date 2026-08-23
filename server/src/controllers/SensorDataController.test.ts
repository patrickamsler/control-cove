import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { SensorDataController } from './SensorDataController';
import { SensorDataService } from '../services/SensorDataService';

vi.mock('../config/devices', async () => (await import('../test/fixtures')).devicesModuleMock());

const createController = (
  switchState: Record<number, { device_id: string; state: boolean }> = {},
  sensorState: Record<number, { device_id: string; temperature: number; humidity: number }> = {}
) => {
  const service = {
    getSwitchData: (id: number) => switchState[id],
    getSensorData: (id: number) => sensorState[id],
  } as unknown as SensorDataService;
  return new SensorDataController(service);
};

const callGetSensorData = (controller: SensorDataController) => {
  const json = vi.fn();
  controller.getSensorData({} as Request, { json } as unknown as Response);
  expect(json).toHaveBeenCalledTimes(1);
  return json.mock.calls[0][0];
};

describe('SensorDataController.getSensorData', () => {
  it('returns every configured device with id and name when there is no live state', () => {
    const dto = callGetSensorData(createController());

    expect(dto).toEqual({
      switches: [
        { id: 10, name: 'Test Lamp' },
        { id: 20, name: 'Test Fan' },
      ],
      environmentSensors: [
        { id: 1, name: 'Test Livingroom' },
        { id: 2, name: 'Test Bathroom' },
      ],
    });
  });

  it('omits state, temperature and humidity keys entirely when no data has arrived', () => {
    const dto = callGetSensorData(createController());

    expect(dto.switches[0]).not.toHaveProperty('state');
    expect(dto.environmentSensors[0]).not.toHaveProperty('temperature');
    expect(dto.environmentSensors[0]).not.toHaveProperty('humidity');
  });

  it('overlays live state only onto the devices that have data', () => {
    const controller = createController(
      { 10: { device_id: 'lamp', state: true } },
      { 2: { device_id: 'bathroom', temperature: 21.5, humidity: 55 } }
    );

    const dto = callGetSensorData(controller);

    expect(dto.switches).toEqual([
      { id: 10, name: 'Test Lamp', state: true },
      { id: 20, name: 'Test Fan' }, // TODO: Should this be omitted entirely if no state has been received yet? (See comment in SensorDataController.addCurrentState)
    ]);
    expect(dto.environmentSensors).toEqual([
      { id: 1, name: 'Test Livingroom' }, // TODO: Should this be omitted entirely if no state has been received yet? (See comment in SensorDataController.addCurrentState)
      { id: 2, name: 'Test Bathroom', temperature: 21.5, humidity: 55 },
    ]);
  });

  it('keeps a switch reported as off in the response', () => {
    const controller = createController({ 20: { device_id: 'fan', state: false } });

    const dto = callGetSensorData(controller);

    expect(dto.switches[1]).toEqual({ id: 20, name: 'Test Fan', state: false });
  });
});
