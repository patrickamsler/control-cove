import { beforeEach, describe, expect, it, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/server';
import { DeviceService, SwitchCommandPort } from '../domain/DeviceService';
import { awaitSwitchState, registerMcpHandlers } from './registerMcpHandlers';

vi.mock('../domain/devices', async () => (await import('../test/fixtures.js')).devicesModuleMock());

type ToolResult = {
  isError?: boolean;
  content: { type: string; text: string }[];
  structuredContent?: Record<string, unknown>;
};

/**
 * The transport is faked the same way registerWebSocketHandlers.test.ts fakes
 * WebSocketService: record what was registered, then call the handlers directly.
 */
const setup = () => {
  const toolHandlers: Record<string, (args: never) => Promise<ToolResult>> = {};
  const toolConfigs: Record<string, { description?: string; inputSchema?: unknown }> = {};
  const resourceNames: string[] = [];
  const resourceReaders: Record<string, (uri: URL, variables: Record<string, string>) => Promise<unknown>> = {};

  const server = {
    registerTool: vi.fn((name: string, config: never, handler: never) => {
      toolConfigs[name] = config;
      toolHandlers[name] = handler;
    }),
    registerResource: vi.fn((name: string, _uriOrTemplate: unknown, _config: unknown, reader: never) => {
      resourceNames.push(name);
      resourceReaders[name] = reader;
    }),
  } as unknown as McpServer;

  const commands: SwitchCommandPort = {sendSwitchCommand: vi.fn()};
  const deviceService = new DeviceService(commands);
  registerMcpHandlers(server, deviceService);

  return {
    commands,
    deviceService,
    toolConfigs,
    resourceNames,
    resourceReaders,
    call: (name: string, args: unknown = {}) => toolHandlers[name](args as never),
  };
};

let ctx: ReturnType<typeof setup>;

beforeEach(() => {
  vi.useRealTimers();
  ctx = setup();
});

const structured = (result: ToolResult) => result.structuredContent as Record<string, never>;

describe('tool registration', () => {
  it('registers exactly the five device tools', () => {
    expect(Object.keys(ctx.toolConfigs).sort()).toEqual([
      'get_sensor',
      'get_switch',
      'list_sensors',
      'list_switches',
      'set_switch',
    ]);
  });

  it('gives every tool a description for the agent to read', () => {
    Object.values(ctx.toolConfigs).forEach((config) => {
      expect(config.description).toBeTruthy();
    });
  });

  it('registers the overview resource and both templates', () => {
    expect(ctx.resourceNames.sort()).toEqual(['devices', 'sensor', 'switch']);
  });
});

describe('the read tools', () => {
  it('lists the configured switches', async () => {
    const result = await ctx.call('list_switches');

    expect(structured(result).switches).toEqual([
      {id: 10, name: 'Test Lamp'},
      {id: 20, name: 'Test Fan'},
    ]);
  });

  it('lists the configured sensors', async () => {
    const result = await ctx.call('list_sensors');

    expect(structured(result).sensors).toEqual([
      {id: 1, name: 'Test Livingroom'},
      {id: 2, name: 'Test Bathroom'},
    ]);
  });

  it('reports a switch state once the device has published one', async () => {
    ctx.deviceService.applySwitchState(10, true);

    const result = await ctx.call('get_switch', {id: 10});

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({id: 10, name: 'Test Lamp', state: true});
  });

  it('includes the server-internal deviceId in get_sensor', async () => {
    ctx.deviceService.applySensorReading(1, {temperature: 21.5, humidity: 48, deviceId: 'dht-living'});

    const result = await ctx.call('get_sensor', {id: 1});

    expect(result.structuredContent).toEqual({
      id: 1,
      name: 'Test Livingroom',
      temperature: 21.5,
      humidity: 48,
      deviceId: 'dht-living',
    });
  });

  it('omits deviceId when the device did not send one', async () => {
    ctx.deviceService.applySensorReading(1, {temperature: 19, humidity: 55});

    const result = await ctx.call('get_sensor', {id: 1});

    expect(result.structuredContent).not.toHaveProperty('deviceId');
  });

  it.each([
    ['get_switch', 'switch'],
    ['get_sensor', 'sensor'],
  ])('%s answers with an error for an unknown id', async (tool, label) => {
    const result = await ctx.call(tool, {id: 999});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No ' + label + ' with id 999');
  });
});

describe('set_switch', () => {
  it('publishes the command exactly once and confirms when the device reports back', async () => {
    const pending = ctx.call('set_switch', {id: 10, state: true});
    ctx.deviceService.applySwitchState(10, true);

    const result = await pending;

    expect(ctx.commands.sendSwitchCommand).toHaveBeenCalledExactlyOnceWith(10, true);
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({id: 10, name: 'Test Lamp', state: true});
  });

  it('ignores a report from a different switch', async () => {
    vi.useFakeTimers();
    const pending = ctx.call('set_switch', {id: 10, state: true});
    ctx.deviceService.applySwitchState(20, true);
    await vi.advanceTimersByTimeAsync(5000);

    const result = await pending;

    expect(result.isError).toBe(true);
  });

  it('ignores a report of the opposite state', async () => {
    vi.useFakeTimers();
    const pending = ctx.call('set_switch', {id: 10, state: true});
    ctx.deviceService.applySwitchState(10, false);
    await vi.advanceTimersByTimeAsync(5000);

    const result = await pending;

    expect(result.isError).toBe(true);
  });

  it('reports a timeout without claiming the light changed', async () => {
    vi.useFakeTimers();
    const pending = ctx.call('set_switch', {id: 10, state: false});
    await vi.advanceTimersByTimeAsync(5000);

    const result = await pending;

    expect(ctx.commands.sendSwitchCommand).toHaveBeenCalledExactlyOnceWith(10, false);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('did not report back');
    expect(result.content[0].text).toContain('The command was published');
  });

  it('refuses an unknown id without publishing anything', async () => {
    const result = await ctx.call('set_switch', {id: 999, state: true});

    expect(result.isError).toBe(true);
    expect(ctx.commands.sendSwitchCommand).not.toHaveBeenCalled();
  });

  it('leaves no listener behind after a confirmed command', async () => {
    const pending = ctx.call('set_switch', {id: 10, state: true});
    ctx.deviceService.applySwitchState(10, true);
    await pending;

    expect(listenerCount(ctx.deviceService)).toBe(0);
  });

  it('leaves no listener behind after a timeout', async () => {
    vi.useFakeTimers();
    const pending = ctx.call('set_switch', {id: 10, state: true});
    await vi.advanceTimersByTimeAsync(5000);
    await pending;

    expect(listenerCount(ctx.deviceService)).toBe(0);
  });
});

describe('awaitSwitchState', () => {
  it('resolves with the reported DTO', async () => {
    const pending = awaitSwitchState(ctx.deviceService, 20, true, 1000);
    ctx.deviceService.applySwitchState(20, true);

    await expect(pending).resolves.toEqual({id: 20, name: 'Test Fan', state: true});
  });

  it('resolves undefined once the timeout elapses', async () => {
    vi.useFakeTimers();
    const pending = awaitSwitchState(ctx.deviceService, 20, true, 250);
    await vi.advanceTimersByTimeAsync(250);

    await expect(pending).resolves.toBeUndefined();
  });
});

describe('the resources', () => {
  it('reads both device lists from devices://all', async () => {
    const result = (await ctx.resourceReaders['devices'](
        new URL('devices://all'),
        {},
    )) as { contents: { text: string }[] };

    expect(JSON.parse(result.contents[0].text)).toEqual({
      switches: [
        {id: 10, name: 'Test Lamp'},
        {id: 20, name: 'Test Fan'},
      ],
      sensors: [
        {id: 1, name: 'Test Livingroom'},
        {id: 2, name: 'Test Bathroom'},
      ],
    });
  });

  it('reads a single switch from its template uri', async () => {
    const result = (await ctx.resourceReaders['switch'](new URL('switch://10'), {id: '10'})) as {
      contents: { text: string }[];
    };

    expect(JSON.parse(result.contents[0].text)).toEqual({id: 10, name: 'Test Lamp'});
  });

  it('throws for an unknown template id', async () => {
    await expect(ctx.resourceReaders['sensor'](new URL('sensor://999'), {id: '999'})).rejects.toThrow(
        'No sensor with id 999',
    );
  });
});

/** Reaches into the domain's emitter to prove set_switch cleans up after itself. */
const listenerCount = (deviceService: DeviceService): number =>
    (deviceService as unknown as { events: { listenerCount(name: string): number } }).events.listenerCount('switch');
