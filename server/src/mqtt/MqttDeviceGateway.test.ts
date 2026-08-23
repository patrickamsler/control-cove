import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeviceService } from '../domain/DeviceService';
import { MqttClient } from './MqttClient';
import { MqttDeviceGateway } from './MqttDeviceGateway';

vi.mock('../domain/devices', async () => (await import('../test/fixtures')).devicesModuleMock());

const setup = () => {
  const publishMessage = vi.fn();
  const topicHandlers = new Map<string, (message: string) => void>();
  const mqttClient = {
    publishMessage,
    subscribeToTopic: vi.fn((topic: string, onMessage: (message: string) => void) => {
      topicHandlers.set(topic, onMessage);
    }),
  } as unknown as MqttClient;

  const gateway = new MqttDeviceGateway(mqttClient);
  const deviceService = new DeviceService(gateway);
  gateway.start(deviceService);

  return {
    gateway,
    deviceService,
    mqttClient,
    publishMessage,
    publish: (topic: string, message: string) => topicHandlers.get(topic)!(message),
    topicHandlers,
  };
};

let ctx: ReturnType<typeof setup>;

beforeEach(() => {
  ctx = setup();
});

describe('MqttDeviceGateway subscriptions', () => {
  it('subscribes to every configured sensor status and switch state topic', () => {
    expect([...ctx.topicHandlers.keys()]).toEqual([
      'devices/livingroom/sensors/status',
      'devices/bathroom/sensors/status',
      'shellies/lamp/relay/0',
      'shellies/fan/relay/0',
    ]);
  });
});

describe('MqttDeviceGateway sensor payloads', () => {
  it('applies a valid reading to the device service', () => {
    ctx.publish('devices/livingroom/sensors/status', '{"temperature":21.5,"humidity":48}');

    expect(ctx.deviceService.getSensor(1)).toEqual({
      id: 1, name: 'Test Livingroom', temperature: 21.5, humidity: 48,
    });
  });

  it('keeps the reported device_id server-internal, off the DTO', () => {
    ctx.publish('devices/livingroom/sensors/status', '{"device_id":"A001","temperature":20,"humidity":40}');

    expect(ctx.deviceService.getSensorReading(1)).toEqual({
      temperature: 20, humidity: 40, deviceId: 'A001',
    });
    expect(ctx.deviceService.getSensor(1)).toEqual({
      id: 1, name: 'Test Livingroom', temperature: 20, humidity: 40,
    });
  });

  it('falls back to the topic when the device reports no device_id', () => {
    ctx.publish('devices/livingroom/sensors/status', '{"temperature":20,"humidity":40}');

    expect(ctx.deviceService.getSensorReading(1)?.deviceId).toBe('devices/livingroom/sensors/status');
  });

  it('keeps a valid reading when the device_id is not a string', () => {
    ctx.publish('devices/livingroom/sensors/status', '{"device_id":42,"temperature":20,"humidity":40}');

    expect(ctx.deviceService.getSensorReading(1)).toEqual({
      temperature: 20, humidity: 40, deviceId: 'devices/livingroom/sensors/status',
    });
  });

  it.each([
    ['malformed JSON', 'not json'],
    ['a non-object payload', '42'],
    ['a non-numeric temperature', '{"temperature":"warm","humidity":48}'],
    ['a missing humidity', '{"temperature":21.5}'],
  ])('drops %s and keeps the last good reading', (_label, message) => {
    ctx.publish('devices/livingroom/sensors/status', '{"temperature":21.5,"humidity":48}');

    expect(() => ctx.publish('devices/livingroom/sensors/status', message)).not.toThrow();

    expect(ctx.deviceService.getSensor(1)).toEqual({
      id: 1, name: 'Test Livingroom', temperature: 21.5, humidity: 48,
    });
  });
});

describe('MqttDeviceGateway switch payloads', () => {
  it.each([
    ['on', true],
    ['off', false],
  ])('maps the payload "%s" to state %s', (message, expected) => {
    ctx.publish('shellies/lamp/relay/0', message);

    expect(ctx.deviceService.getSwitch(10)).toEqual({ id: 10, name: 'Test Lamp', state: expected });
  });

  it('ignores an unexpected payload instead of treating it as off', () => {
    ctx.publish('shellies/lamp/relay/0', 'on');

    expect(() => ctx.publish('shellies/lamp/relay/0', 'toggle')).not.toThrow();

    expect(ctx.deviceService.getSwitch(10)).toEqual({ id: 10, name: 'Test Lamp', state: true });
  });
});

describe('MqttDeviceGateway.sendSwitchCommand', () => {
  it('publishes "on" to the command topic of the addressed switch', () => {
    ctx.gateway.sendSwitchCommand(10, true);

    expect(ctx.publishMessage).toHaveBeenCalledExactlyOnceWith('shellies/lamp/relay/0/command', 'on');
  });

  it('publishes "off" when the requested state is false', () => {
    ctx.gateway.sendSwitchCommand(20, false);

    expect(ctx.publishMessage).toHaveBeenCalledExactlyOnceWith('shellies/fan/relay/0/command', 'off');
  });

  it('ignores an unknown switch id without publishing or throwing', () => {
    expect(() => ctx.gateway.sendSwitchCommand(999, true)).not.toThrow();

    expect(ctx.publishMessage).not.toHaveBeenCalled();
  });

  it('is reached through DeviceService.setSwitch', () => {
    ctx.deviceService.setSwitch(10, true);

    expect(ctx.publishMessage).toHaveBeenCalledExactlyOnceWith('shellies/lamp/relay/0/command', 'on');
  });
});
