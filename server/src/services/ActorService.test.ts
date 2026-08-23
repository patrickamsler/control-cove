import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActorService } from './ActorService';
import { MqttService } from './MqttService';
import { WebSocketService } from './WebSocketService';

// Mock the devices config module to use the test fixtures instead of the real configuration.
vi.mock('../config/devices', async () => (await import('../test/fixtures')).devicesModuleMock());

type SwitchHandler = (data: { id: number; state: boolean }) => void;

const setup = () => {
  const publishMessage = vi.fn();
  const handlers: Partial<Record<string, SwitchHandler>> = {};
  const mqttService = { publishMessage } as unknown as MqttService;
  const webSocketService = {
    onEvent: vi.fn((event: string, callback: SwitchHandler) => {
      handlers[event] = callback;
    }),
  } as unknown as WebSocketService;

  const actorService = new ActorService(mqttService, webSocketService);
  actorService.registerWebsocketEvents();

  return { publishMessage, webSocketService, updateSwitch: handlers['updateSwitch']! };
};

describe('ActorService', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  it('registers a handler for the updateSwitch websocket event', () => {
    expect(ctx.webSocketService.onEvent).toHaveBeenCalledWith('updateSwitch', expect.any(Function));
    expect(ctx.updateSwitch).toBeTypeOf('function');
  });

  it('publishes "on" to the command topic of the addressed switch', () => {
    ctx.updateSwitch({ id: 10, state: true });

    expect(ctx.publishMessage).toHaveBeenCalledExactlyOnceWith('shellies/lamp/relay/0/command', 'on');
  });

  it('publishes "off" when the requested state is false', () => {
    ctx.updateSwitch({ id: 20, state: false });

    expect(ctx.publishMessage).toHaveBeenCalledExactlyOnceWith('shellies/fan/relay/0/command', 'off');
  });

  it('ignores an unknown switch id without publishing or throwing', () => {
    expect(() => ctx.updateSwitch({ id: 999, state: true })).not.toThrow();

    expect(ctx.publishMessage).not.toHaveBeenCalled();
  });
});
