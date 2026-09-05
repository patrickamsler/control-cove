import { z } from 'zod';

/**
 * Tool input schemas for the MCP adapter.
 *
 * These are server-internal and deliberately separate from the shared DTOs, for
 * the same reason mqtt/payloads.ts is: the tool surface an agent sees is its own
 * contract, not a mirror of the browser API. Tool *outputs* do reuse the shared
 * schemas, since they are the same devices.
 *
 * Every field carries a .describe() — that text is what the agent reads to decide
 * what to pass, so it is load bearing rather than decoration.
 */

const switchId = z
  .number()
  .int()
  .describe('Numeric id of the switch, as returned by list_switches. Switch ids are separate from sensor ids.');

const sensorId = z
  .number()
  .int()
  .describe('Numeric id of the sensor, as returned by list_sensors. Sensor ids are separate from switch ids.');

export const emptyInput = z.object({});

export const switchIdInput = z.object({ id: switchId });

export const sensorIdInput = z.object({ id: sensorId });

export const setSwitchInput = z.object({
  id: switchId,
  state: z.boolean().describe('true turns the light on, false turns it off.'),
});
