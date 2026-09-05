import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeviceService, SwitchCommandPort } from '../domain/DeviceService';
import { WebSocketService } from './WebSocketService';
import { registerWebSocketHandlers } from './registerWebSocketHandlers';

vi.mock('../domain/devices', async () => (await import('../test/fixtures.js')).devicesModuleMock());

const setup = () => {
  const emit = vi.fn();
  const connectionCallbacks: ((socket: { emit: ReturnType<typeof vi.fn> }) => void)[] = [];
  const eventHandlers: Record<string, (payload: unknown) => void> = {};

  const webSocketService = {
    emit,
    onConnection: vi.fn((callback) => connectionCallbacks.push(callback)),
    onEvent: vi.fn((event: string, callback) => {
      eventHandlers[event] = callback;
    }),
  } as unknown as WebSocketService;

  const commands: SwitchCommandPort = { sendSwitchCommand: vi.fn() };
  const deviceService = new DeviceService(commands);
  registerWebSocketHandlers(webSocketService, deviceService);

  return {
    emit,
    commands,
    deviceService,
    updateSwitch: eventHandlers['updateSwitch'],
    // Simulates a client connecting and returns the socket it was handed.
    connect: () => {
      const socket = { emit: vi.fn() };
      connectionCallbacks.forEach((callback) => callback(socket));
      return socket;
    },
  };
};

let ctx: ReturnType<typeof setup>;

beforeEach(() => {
  ctx = setup();
});

describe('the initial snapshot', () => {
  it('sends every configured device to a newly connected client', () => {
    const socket = ctx.connect();

    expect(socket.emit).toHaveBeenCalledExactlyOnceWith('initial', {
      switches: [
        { id: 10, name: 'Test Lamp' },
        { id: 20, name: 'Test Fan' },
      ],
      sensors: [
        { id: 1, name: 'Test Livingroom' },
        { id: 2, name: 'Test Bathroom' },
      ],
    });
  });

  it('includes the state known at connection time', () => {
    ctx.deviceService.applySwitchState(10, true);
    ctx.deviceService.applySensorReading(1, { temperature: 21.5, humidity: 48 });

    const socket = ctx.connect();

    expect(socket.emit).toHaveBeenCalledWith('initial', expect.objectContaining({
      switches: [
        { id: 10, name: 'Test Lamp', state: true },
        { id: 20, name: 'Test Fan' },
      ],
      sensors: [
        { id: 1, name: 'Test Livingroom', temperature: 21.5, humidity: 48 },
        { id: 2, name: 'Test Bathroom' },
      ],
    }));
  });
});

describe('broadcasting device changes', () => {
  it('broadcasts a switch change as a plain DTO', () => {
    ctx.deviceService.applySwitchState(20, false);

    expect(ctx.emit).toHaveBeenCalledExactlyOnceWith('switch', { id: 20, name: 'Test Fan', state: false });
  });

  it('broadcasts a sensor change as a plain DTO', () => {
    ctx.deviceService.applySensorReading(2, { temperature: 19, humidity: 60 });

    expect(ctx.emit).toHaveBeenCalledExactlyOnceWith('sensor', {
      id: 2, name: 'Test Bathroom', temperature: 19, humidity: 60,
    });
  });
});

describe('the updateSwitch event', () => {
  it('is registered', () => {
    expect(ctx.updateSwitch).toBeTypeOf('function');
  });

  it('forwards a valid payload to the device service', () => {
    ctx.updateSwitch({ id: 10, state: true });

    expect(ctx.commands.sendSwitchCommand).toHaveBeenCalledExactlyOnceWith(10, true);
  });

  it.each([
    ['a missing state', { id: 10 }],
    ['a non-boolean state', { id: 10, state: 'on' }],
    ['a missing id', { state: true }],
    ['a non-object payload', 'on'],
    ['null', null],
  ])('rejects %s without commanding or throwing', (_label, payload) => {
    expect(() => ctx.updateSwitch(payload)).not.toThrow();

    expect(ctx.commands.sendSwitchCommand).not.toHaveBeenCalled();
  });

  it('ignores an unknown switch id', () => {
    ctx.updateSwitch({ id: 999, state: true });

    expect(ctx.commands.sendSwitchCommand).not.toHaveBeenCalled();
  });
});
