import { McpServer, ResourceTemplate } from '@modelcontextprotocol/server';
import { SwitchDto } from '@control-cove/shared';
import { DeviceService } from '../domain/DeviceService';
import { emptyInput, sensorIdInput, setSwitchInput, switchIdInput } from './schemas';
import logger from '../logger';

/** How long set_switch waits for the device to report the state back over MQTT. */
export const DEFAULT_COMMAND_TIMEOUT_MS = 5000;

const commandTimeoutMs = (): number =>
    Number(process.env.MCP_COMMAND_TIMEOUT_MS) || DEFAULT_COMMAND_TIMEOUT_MS;

/** A tool result carrying JSON, in both the text and structured forms clients expect. */
const ok = (payload: unknown) => ({
  content: [{
    type: 'text' as const,
    text: JSON.stringify(payload, null, 2)
  }],
  structuredContent: payload as Record<string, unknown>,
});

/**
 * Unlike the WebSocket adapter, which logs a bad payload and drops it, an MCP tool
 * has a caller waiting for an answer — so problems come back as errors the agent can
 * act on, and the log line is kept as well.
 */
const fail = (message: string) => {
  logger.error(`[MCP] ${message}`);
  return {
    isError: true,
    content: [{
      type: 'text' as const,
      text: message
    }]
  };
};

/**
 * Waits for a switch to report the state it was just commanded into.
 *
 * DeviceService.setSwitch is fire-and-forget: the state map only updates when the
 * device publishes back. Resolves true on confirmation, false on timeout. Exported
 * so it can be tested on its own with fake timers.
 */
export function awaitSwitchState(
    deviceService: DeviceService,
    id: number,
    state: boolean,
    timeoutMs: number,
): Promise<SwitchDto | undefined> {
  return new Promise((resolve) => {
    let timer: NodeJS.Timeout;

    const dispose = deviceService.onSwitchChanged((data) => {
      if (data.id !== id || data.state !== state) {
        return;
      }
      clearTimeout(timer);
      dispose();
      resolve(data);
    });

    timer = setTimeout(() => {
      dispose();
      resolve(undefined);
    }, timeoutMs);
  });
}

/**
 * Bridges the domain to an MCP server: read tools over the device lists, a write tool
 * that waits for the device to confirm, and read-only resources for the same state.
 *
 * Takes McpServer rather than a transport, so it is registered once per server
 * instance and stays testable against a fake.
 */
export function registerMcpHandlers(server: McpServer, deviceService: DeviceService): void {
  server.registerTool(
      'list_switches',
      {
        title: 'List switches',
        description:
            'Lists every configured light switch with its id, name and latest known state. ' +
            'A switch with no "state" field has not reported since the server started.',
        inputSchema: emptyInput,
      },
      async () => ok({switches: deviceService.getSwitches()}),
  );

  server.registerTool(
      'get_switch',
      {
        title: 'Get one switch',
        description: 'Reads the current state of a single light switch by id.',
        inputSchema: switchIdInput,
      },
      async ({id}) => {
        const found = deviceService.getSwitch(id);
        return found
            ? ok(found)
            : fail(`No switch with id ${id}. Call list_switches to see the available ids.`);
      },
  );

  server.registerTool(
      'set_switch',
      {
        title: 'Turn a light on or off',
        description:
            'Turns a light switch on or off and waits for the device to confirm. ' +
            'Returns the confirmed state, or an error if the device does not report back.',
        inputSchema: setSwitchInput,
        annotations: {destructiveHint: false, idempotentHint: true, openWorldHint: true},
      },
      async ({id, state}) => {
        const target = deviceService.getSwitch(id);
        if (!target) {
          return fail(`No switch with id ${id}. Call list_switches to see the available ids.`);
        }

        const timeoutMs = commandTimeoutMs();
        // Subscribe before commanding, so a fast device cannot report back first.
        const confirmed = awaitSwitchState(deviceService, id, state, timeoutMs);
        deviceService.setSwitch(id, state);

        const result = await confirmed;
        if (!result) {
          return fail(
              `Commanded switch ${id} (${target.name}) to ${state ? 'on' : 'off'}, but it did not ` +
              `report back within ${timeoutMs}ms — it may be offline. The command was published.`,
          );
        }

        logger.info(`[MCP] Switch ${id} (${target.name}) confirmed ${state ? 'on' : 'off'}`);
        return ok(result);
      },
  );

  server.registerTool(
      'list_sensors',
      {
        title: 'List sensors',
        description:
            'Lists every configured environment sensor with its id, name and latest temperature ' +
            '(degrees Celsius) and humidity (percent). A sensor with no readings has not published yet.',
        inputSchema: emptyInput,
      },
      async () => ok({sensors: deviceService.getSensors()}),
  );

  server.registerTool(
      'get_sensor',
      {
        title: 'Get one sensor',
        description:
            'Reads the latest temperature (degrees Celsius) and humidity (percent) from a single sensor by id.',
        inputSchema: sensorIdInput,
      },
      async ({id}) => {
        const found = deviceService.getSensor(id);
        if (!found) {
          return fail(`No sensor with id ${id}. Call list_sensors to see the available ids.`);
        }
        // getSensorReading is the accessor that keeps deviceId off SensorDto; this layer
        // is server-side, so it is the one consumer allowed to see it.
        const deviceId = deviceService.getSensorReading(id)?.deviceId;
        return ok(deviceId === undefined ? found : {...found, deviceId});
      },
  );

  server.registerResource(
      'devices',
      'devices://all',
      {
        title: 'All devices',
        description: 'Every configured switch and sensor with its latest known state, as one document.',
        mimeType: 'application/json',
      },
      async (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(
                {switches: deviceService.getSwitches(), sensors: deviceService.getSensors()},
                null,
                2,
            ),
          },
        ],
      }),
  );

  server.registerResource(
      'switch',
      new ResourceTemplate('switch://{id}', {
        list: async () => ({
          resources: deviceService.getSwitches().map((item) => ({
            uri: `switch://${item.id}`,
            name: item.name,
            mimeType: 'application/json',
          })),
        }),
      }),
      {title: 'Switch', description: 'One light switch and its latest known state.', mimeType: 'application/json'},
      async (uri, {id}) => {
        const found = deviceService.getSwitch(Number(id));
        if (!found) {
          throw new Error(`No switch with id ${String(id)}`);
        }
        return {contents: [{uri: uri.href, mimeType: 'application/json', text: JSON.stringify(found, null, 2)}]};
      },
  );

  server.registerResource(
      'sensor',
      new ResourceTemplate('sensor://{id}', {
        list: async () => ({
          resources: deviceService.getSensors().map((item) => ({
            uri: `sensor://${item.id}`,
            name: item.name,
            mimeType: 'application/json',
          })),
        }),
      }),
      {title: 'Sensor', description: 'One environment sensor and its latest reading.', mimeType: 'application/json'},
      async (uri, {id}) => {
        const found = deviceService.getSensor(Number(id));
        if (!found) {
          throw new Error(`No sensor with id ${String(id)}`);
        }
        return {contents: [{uri: uri.href, mimeType: 'application/json', text: JSON.stringify(found, null, 2)}]};
      },
  );
}
