import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SensorDataService } from './SensorDataService';
import { MqttService } from './MqttService';
import { WebSocketService } from './WebSocketService';

// Mock the devices module to provide a controlled set of devices for testing
vi.mock('../config/devices', async () => (await import('../test/fixtures')).devicesModuleMock());

const LIVING_ROOM_TOPIC = 'devices/livingroom/sensors/status';
const LAMP_STATE_TOPIC = 'shellies/lamp/relay/0';

const setup = () => {
  const listeners: Record<string, (message: string) => void> = {};
  const emit = vi.fn();
  const connectionHandlers: ((socket: { emit: ReturnType<typeof vi.fn> }) => void)[] = [];

  const mqttService = {
    subscribeToTopic: vi.fn((topic: string, onMessage: (message: string) => void) => {
      listeners[topic] = onMessage;
    }),
  } as unknown as MqttService;

  const webSocketService = {
    emit,
    onConnection: vi.fn((callback: (socket: { emit: ReturnType<typeof vi.fn> }) => void) => {
      connectionHandlers.push(callback);
    }),
  } as unknown as WebSocketService;

  const service = new SensorDataService(mqttService, webSocketService);

  return {
    service,
    mqttService,
    emit,
    publish: (topic: string, message: string) => listeners[topic](message),
    connect: () => {
      const socket = { emit: vi.fn() };
      connectionHandlers.forEach((handler) => handler(socket));
      return socket;
    },
  };
};

describe('SensorDataService.registerMqttTopics', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
    ctx.service.registerMqttTopics();
  });

  it('subscribes to every configured sensor and switch topic', () => {
    expect(ctx.mqttService.subscribeToTopic).toHaveBeenCalledTimes(4);
    expect(ctx.mqttService.subscribeToTopic).toHaveBeenCalledWith(LIVING_ROOM_TOPIC, expect.any(Function));
    expect(ctx.mqttService.subscribeToTopic).toHaveBeenCalledWith(LAMP_STATE_TOPIC, expect.any(Function));
  });

  describe('sensor payloads', () => {
    it('stores a valid reading and emits it to websocket clients', () => {
      ctx.publish(LIVING_ROOM_TOPIC, JSON.stringify({ device_id: 'sensor-a', temperature: 21.5, humidity: 48 }));

      const expected = { device_id: 'sensor-a', temperature: 21.5, humidity: 48 };
      expect(ctx.service.getSensorData(1)).toEqual(expected);
      expect(ctx.emit).toHaveBeenCalledExactlyOnceWith('sensor', { id: 1, data: expected });
    });

    it('falls back to the topic as device_id when the payload has none', () => {
      ctx.publish(LIVING_ROOM_TOPIC, JSON.stringify({ temperature: 20, humidity: 40 }));

      expect(ctx.service.getSensorData(1)?.device_id).toBe(LIVING_ROOM_TOPIC);
    });

    it('falls back to the topic when device_id is not a string', () => {
      ctx.publish(LIVING_ROOM_TOPIC, JSON.stringify({ device_id: 42, temperature: 20, humidity: 40 }));

      expect(ctx.service.getSensorData(1)?.device_id).toBe(LIVING_ROOM_TOPIC);
    });

    it('overwrites the previous reading for the same sensor', () => {
      ctx.publish(LIVING_ROOM_TOPIC, JSON.stringify({ temperature: 20, humidity: 40 }));
      ctx.publish(LIVING_ROOM_TOPIC, JSON.stringify({ temperature: 25, humidity: 45 }));

      expect(ctx.service.getSensorData(1)).toMatchObject({ temperature: 25, humidity: 45 });
    });

    it.each([
      ['malformed JSON', 'not json at all'],
      ['a null payload', 'null'],
      ['an array payload', '[]'],
      ['a bare number', '5'],
      ['a non-numeric temperature', JSON.stringify({ temperature: '21', humidity: 40 })],
      ['a missing humidity', JSON.stringify({ temperature: 21 })],
    ])('drops %s without storing or emitting', (_label, payload) => {
      ctx.publish(LIVING_ROOM_TOPIC, payload);

      expect(ctx.service.getSensorData(1)).toBeUndefined();
      expect(ctx.emit).not.toHaveBeenCalled();
    });

    it('keeps the last good reading when a malformed payload follows it', () => {
      ctx.publish(LIVING_ROOM_TOPIC, JSON.stringify({ temperature: 20, humidity: 40 }));
      ctx.publish(LIVING_ROOM_TOPIC, 'garbage');

      expect(ctx.service.getSensorData(1)).toMatchObject({ temperature: 20, humidity: 40 });
      expect(ctx.emit).toHaveBeenCalledTimes(1);
    });
  });

  describe('switch payloads', () => {
    it('maps "on" to state true and derives device_id from the state topic', () => {
      ctx.publish(LAMP_STATE_TOPIC, 'on');

      const expected = { device_id: 'lamp', state: true };
      expect(ctx.service.getSwitchData(10)).toEqual(expected);
      expect(ctx.emit).toHaveBeenCalledExactlyOnceWith('switch', { id: 10, data: expected });
    });

    it.each(['off', 'ON', '', 'anything else'])('maps %o to state false', (message) => {
      ctx.publish(LAMP_STATE_TOPIC, message);
      // TODO for this cases, we should probably emit a warning to the log, but for now we just treat it as "off"
      expect(ctx.service.getSwitchData(10)).toEqual({ device_id: 'lamp', state: false });
    });
  });

  it('leaves state for devices that never reported undefined', () => {
    expect(ctx.service.getSensorData(2)).toBeUndefined();
    expect(ctx.service.getSwitchData(20)).toBeUndefined();
  });
});

describe('SensorDataService.registerWebsocketEvents', () => {
  it('sends an empty snapshot to a client connecting before any data arrives', () => {
    const ctx = setup();
    ctx.service.registerWebsocketEvents();

    const socket = ctx.connect();

    expect(socket.emit).toHaveBeenCalledExactlyOnceWith('initial', { sensors: [], switches: [] });
  });

  it('sends a snapshot of everything received so far', () => {
    const ctx = setup();
    ctx.service.registerMqttTopics();
    ctx.service.registerWebsocketEvents();
    ctx.publish(LIVING_ROOM_TOPIC, JSON.stringify({ device_id: 'sensor-a', temperature: 21, humidity: 44 }));
    ctx.publish(LAMP_STATE_TOPIC, 'on');

    const socket = ctx.connect();

    expect(socket.emit).toHaveBeenCalledExactlyOnceWith('initial', {
      sensors: [{ id: 1, data: { device_id: 'sensor-a', temperature: 21, humidity: 44 } }],
      switches: [{ id: 10, data: { device_id: 'lamp', state: true } }],
    });
  });
});
