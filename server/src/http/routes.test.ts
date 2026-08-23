import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Request, Response } from 'express';
import { DeviceService, SwitchCommandPort } from '../domain/DeviceService';
import { createApiRouter } from './routes';
import { SensorController } from './SensorController';
import { SwitchController } from './SwitchController';

vi.mock('../domain/devices', async () => (await import('../test/fixtures')).devicesModuleMock());

const request = {} as Request;
const response = () => ({ json: vi.fn() } as unknown as Response & { json: ReturnType<typeof vi.fn> });

let deviceService: DeviceService;

beforeEach(() => {
  const commands: SwitchCommandPort = { sendSwitchCommand: vi.fn() };
  deviceService = new DeviceService(commands);
});

describe('SwitchController', () => {
  it('responds with every switch', () => {
    const res = response();

    new SwitchController(deviceService).getSwitches(request, res);

    expect(res.json).toHaveBeenCalledExactlyOnceWith([
      { id: 10, name: 'Test Lamp' },
      { id: 20, name: 'Test Fan' },
    ]);
  });

  it('includes the live state', () => {
    deviceService.applySwitchState(10, true);
    const res = response();

    new SwitchController(deviceService).getSwitches(request, res);

    expect(res.json).toHaveBeenCalledWith([
      { id: 10, name: 'Test Lamp', state: true },
      { id: 20, name: 'Test Fan' },
    ]);
  });
});

describe('SensorController', () => {
  it('responds with every sensor', () => {
    const res = response();

    new SensorController(deviceService).getSensors(request, res);

    expect(res.json).toHaveBeenCalledExactlyOnceWith([
      { id: 1, name: 'Test Livingroom' },
      { id: 2, name: 'Test Bathroom' },
    ]);
  });

  it('includes the live reading', () => {
    deviceService.applySensorReading(2, { temperature: 19, humidity: 60 });
    const res = response();

    new SensorController(deviceService).getSensors(request, res);

    expect(res.json).toHaveBeenCalledWith([
      { id: 1, name: 'Test Livingroom' },
      { id: 2, name: 'Test Bathroom', temperature: 19, humidity: 60 },
    ]);
  });
});

describe('createApiRouter', () => {
  it('registers a GET route for each device kind', () => {
    const routes = createApiRouter(deviceService).stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => [Object.keys(layer.route.methods)[0], layer.route.path]);

    expect(routes).toEqual([
      ['get', '/switches'],
      ['get', '/sensors'],
    ]);
  });
});
