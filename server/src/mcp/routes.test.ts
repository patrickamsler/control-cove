import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { AddressInfo } from 'net';
import { Server } from 'http';
import { DeviceService, SwitchCommandPort } from '../domain/DeviceService';
import { createMcpRouter } from './routes';

vi.mock('../domain/devices', async () => (await import('../test/fixtures.js')).devicesModuleMock());

/**
 * Driven over a real socket rather than a mocked transport: the point of these tests
 * is the wiring — body parsing, the stateless transport, the origin guard — which a
 * fake would define away. An ephemeral port keeps it dependency-free.
 */
const setup = async () => {
  const commands: SwitchCommandPort = {sendSwitchCommand: vi.fn()};
  const deviceService = new DeviceService(commands);

  const app = express();
  app.use(express.json());
  app.use('/mcp', createMcpRouter(deviceService));

  const server: Server = await new Promise((resolve) => {
    const listening = app.listen(0, () => resolve(listening));
  });
  const port = (server.address() as AddressInfo).port;

  let nextId = 1;
  const rpc = async (method: string, params?: unknown, headers: Record<string, string> = {}) => {
    const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'MCP-Protocol-Version': '2025-06-18',
        ...headers,
      },
      body: JSON.stringify({jsonrpc: '2.0', id: nextId++, method, params}),
    });
    return {status: response.status, body: await response.json().catch(() => null)};
  };

  return {server, port, rpc, deviceService, commands};
};

let ctx: Awaited<ReturnType<typeof setup>>;

beforeEach(async () => {
  ctx = await setup();
});

afterEach(async () => {
  await new Promise((resolve) => ctx.server.close(resolve));
});

const initialize = () =>
    ctx.rpc('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: {name: 'vitest', version: '1.0.0'},
    });

describe('the /mcp endpoint', () => {
  it('completes the initialize handshake', async () => {
    const {status, body} = await initialize();

    expect(status).toBe(200);
    expect(body.result.serverInfo).toMatchObject({name: 'control-cove'});
  });

  it('answers with plain JSON rather than an event stream', async () => {
    const response = await fetch(`http://127.0.0.1:${ctx.port}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {protocolVersion: '2025-06-18', capabilities: {}, clientInfo: {name: 'v', version: '1'}},
      }),
    });

    expect(response.headers.get('content-type')).toContain('application/json');
  });

  it('advertises the five device tools', async () => {
    await initialize();

    const {body} = await ctx.rpc('tools/list', {});

    expect(body.result.tools.map((tool: { name: string }) => tool.name).sort()).toEqual([
      'get_sensor',
      'get_switch',
      'list_sensors',
      'list_switches',
      'set_switch',
    ]);
  });

  it('generates a JSON Schema clients can build a form from', async () => {
    await initialize();

    const {body} = await ctx.rpc('tools/list', {});
    const setSwitch = body.result.tools.find((tool: { name: string }) => tool.name === 'set_switch');

    expect(setSwitch.inputSchema).toMatchObject({
      type: 'object',
      properties: {id: {type: 'integer'}, state: {type: 'boolean'}},
    });
    expect(setSwitch.inputSchema.required.sort()).toEqual(['id', 'state']);
  });

  it('lists the templated device resources', async () => {
    await initialize();

    const {body} = await ctx.rpc('resources/list', {});

    expect(body.result.resources.map((resource: { uri: string }) => resource.uri).sort()).toEqual([
      'devices://all',
      'sensor://1',
      'sensor://2',
      'switch://10',
      'switch://20',
    ]);
  });

  it('runs a tool end to end', async () => {
    ctx.deviceService.applySensorReading(1, {temperature: 21.5, humidity: 48});
    await initialize();

    const {body} = await ctx.rpc('tools/call', {name: 'get_sensor', arguments: {id: 1}});

    expect(body.result.structuredContent).toEqual({
      id: 1,
      name: 'Test Livingroom',
      temperature: 21.5,
      humidity: 48,
    });
  });

  it('rejects arguments that do not match the tool schema', async () => {
    await initialize();

    const {body} = await ctx.rpc('tools/call', {name: 'get_switch', arguments: {id: 'ten'}});

    expect(body.error ?? body.result.isError).toBeTruthy();
    expect(ctx.commands.sendSwitchCommand).not.toHaveBeenCalled();
  });

  it('serves concurrent clients from independent stateless sessions', async () => {
    const [first, second] = await Promise.all([initialize(), initialize()]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.result.serverInfo.name).toBe('control-cove');
    expect(second.body.result.serverInfo.name).toBe('control-cove');
  });
});

describe('the origin guard', () => {
  it('accepts a request with no Origin header, as real MCP clients send', async () => {
    const {status} = await initialize();

    expect(status).toBe(200);
  });

  it('accepts a same-origin browser request', async () => {
    const {status} = await ctx.rpc('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: {name: 'browser', version: '1.0.0'},
    }, {Origin: `http://127.0.0.1:${ctx.port}`});

    expect(status).toBe(200);
  });

  it('rejects a cross-origin browser request', async () => {
    const {status} = await ctx.rpc('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: {name: 'evil', version: '1.0.0'},
    }, {Origin: 'http://evil.example.com'});

    expect(status).toBe(403);
  });
});
