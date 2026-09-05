import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeviceService, SwitchCommandPort } from './DeviceService';

// Use the test fixtures instead of the real device configuration.
vi.mock('../domain/devices', async () => (await import('../test/fixtures.js')).devicesModuleMock());

const setup = () => {
  const commands: SwitchCommandPort = { sendSwitchCommand: vi.fn() };
  return { commands, deviceService: new DeviceService(commands) };
};

let ctx: ReturnType<typeof setup>;

beforeEach(() => {
  ctx = setup();
});

describe('DeviceService reads', () => {
  it('lists every configured switch and sensor', () => {
    expect(ctx.deviceService.getSwitches()).toEqual([
      { id: 10, name: 'Test Lamp' },
      { id: 20, name: 'Test Fan' },
    ]);
    expect(ctx.deviceService.getSensors()).toEqual([
      { id: 1, name: 'Test Livingroom' },
      { id: 2, name: 'Test Bathroom' },
    ]);
  });

  it('omits the state keys entirely while no device has reported', () => {
    const [lamp] = ctx.deviceService.getSwitches();
    const [livingroom] = ctx.deviceService.getSensors();

    expect(lamp).not.toHaveProperty('state');
    expect(livingroom).not.toHaveProperty('temperature');
    expect(livingroom).not.toHaveProperty('humidity');
  });

  it('overlays live state onto the reporting devices only', () => {
    ctx.deviceService.applySwitchState(10, true);
    ctx.deviceService.applySensorReading(1, { temperature: 21.5, humidity: 48 });

    expect(ctx.deviceService.getSwitches()).toEqual([
      { id: 10, name: 'Test Lamp', state: true },
      { id: 20, name: 'Test Fan' },
    ]);
    expect(ctx.deviceService.getSensors()).toEqual([
      { id: 1, name: 'Test Livingroom', temperature: 21.5, humidity: 48 },
      { id: 2, name: 'Test Bathroom' },
    ]);
  });

  it('preserves a reported state of false rather than treating it as unknown', () => {
    ctx.deviceService.applySwitchState(10, false);

    expect(ctx.deviceService.getSwitch(10)).toEqual({ id: 10, name: 'Test Lamp', state: false });
  });

  it('replaces the previous reading of a device', () => {
    ctx.deviceService.applySensorReading(1, { temperature: 21.5, humidity: 48 });
    ctx.deviceService.applySensorReading(1, { temperature: 22, humidity: 50 });

    expect(ctx.deviceService.getSensor(1)).toEqual({
      id: 1, name: 'Test Livingroom', temperature: 22, humidity: 50,
    });
  });

  it('keeps deviceId out of the sensor DTO but available internally', () => {
    ctx.deviceService.applySensorReading(1, { temperature: 21.5, humidity: 48, deviceId: 'A001' });

    expect(ctx.deviceService.getSensor(1)).toEqual({
      id: 1, name: 'Test Livingroom', temperature: 21.5, humidity: 48,
    });
    expect(ctx.deviceService.getSensorReading(1)).toEqual({
      temperature: 21.5, humidity: 48, deviceId: 'A001',
    });
  });

  it('does not leak deviceId through a change notification either', () => {
    const onSensor = vi.fn();
    ctx.deviceService.onSensorChanged(onSensor);

    ctx.deviceService.applySensorReading(1, { temperature: 21.5, humidity: 48, deviceId: 'A001' });

    expect(onSensor).toHaveBeenCalledExactlyOnceWith({
      id: 1, name: 'Test Livingroom', temperature: 21.5, humidity: 48,
    });
  });

  it('returns undefined for an unknown id', () => {
    expect(ctx.deviceService.getSwitch(999)).toBeUndefined();
    expect(ctx.deviceService.getSensor(999)).toBeUndefined();
    expect(ctx.deviceService.getSensorReading(999)).toBeUndefined();
  });
});

describe('DeviceService.setSwitch', () => {
  it('delegates to the command port', () => {
    ctx.deviceService.setSwitch(20, true);

    expect(ctx.commands.sendSwitchCommand).toHaveBeenCalledExactlyOnceWith(20, true);
  });

  it('does not change the stored state until the device reports back', () => {
    ctx.deviceService.setSwitch(20, true);

    expect(ctx.deviceService.getSwitch(20)).toEqual({ id: 20, name: 'Test Fan' });
  });

  it('ignores an unknown switch id without commanding or throwing', () => {
    expect(() => ctx.deviceService.setSwitch(999, true)).not.toThrow();

    expect(ctx.commands.sendSwitchCommand).not.toHaveBeenCalled();
  });
});

describe('DeviceService change notifications', () => {
  it('notifies subscribers with the updated switch DTO', () => {
    const onSwitch = vi.fn();
    ctx.deviceService.onSwitchChanged(onSwitch);

    ctx.deviceService.applySwitchState(10, true);

    expect(onSwitch).toHaveBeenCalledExactlyOnceWith({ id: 10, name: 'Test Lamp', state: true });
  });

  it('notifies subscribers with the updated sensor DTO', () => {
    const onSensor = vi.fn();
    ctx.deviceService.onSensorChanged(onSensor);

    ctx.deviceService.applySensorReading(2, { temperature: 19, humidity: 60 });

    expect(onSensor).toHaveBeenCalledExactlyOnceWith({
      id: 2, name: 'Test Bathroom', temperature: 19, humidity: 60,
    });
  });

  it('does not notify for an unknown device id', () => {
    const onSwitch = vi.fn();
    const onSensor = vi.fn();
    ctx.deviceService.onSwitchChanged(onSwitch);
    ctx.deviceService.onSensorChanged(onSensor);

    ctx.deviceService.applySwitchState(999, true);
    ctx.deviceService.applySensorReading(999, { temperature: 1, humidity: 2 });

    expect(onSwitch).not.toHaveBeenCalled();
    expect(onSensor).not.toHaveBeenCalled();
  });
});
