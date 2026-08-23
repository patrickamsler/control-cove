import { z } from 'zod';
import { sensorListSchema, switchListSchema } from './devices.js';
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
