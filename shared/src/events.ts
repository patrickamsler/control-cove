import { z } from 'zod';
import { SensorDto, SwitchDto, sensorListSchema, switchListSchema } from './devices.js';

/** Payload of the `updateSwitch` event the client sends to control a switch. */
export const switchUpdateSchema = z.object({
  id: z.number().int(),
  state: z.boolean(),
});

/** Payload of the `initial` event, a full snapshot sent on every connection. */
export const initialStateSchema = z.object({
  switches: switchListSchema,
  sensors: sensorListSchema,
});

export type SwitchUpdate = z.infer<typeof switchUpdateSchema>;
export type InitialState = z.infer<typeof initialStateSchema>;

/**
 * The socket.io contract. Passing these to `Server<...>` on the server and
 * `Socket<...>` on the client makes both event names and payload shapes a
 * compile error on either side when they drift.
 */
export interface ServerToClientEvents {
  switch: (payload: SwitchDto) => void;
  sensor: (payload: SensorDto) => void;
  initial: (payload: InitialState) => void;
}

export interface ClientToServerEvents {
  updateSwitch: (payload: SwitchUpdate) => void;
}
