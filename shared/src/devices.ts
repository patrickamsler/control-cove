import { z } from 'zod';

/**
 * The device DTOs. These are the single source of truth for both transports:
 * the REST endpoints return arrays of them and the socket events carry them
 * one at a time. Optional fields are absent until a device has published.
 */

export const switchDtoSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  state: z.boolean().optional(),
});

export const sensorDtoSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  temperature: z.number().optional(),
  humidity: z.number().optional(),
});

export const switchListSchema = z.array(switchDtoSchema);
export const sensorListSchema = z.array(sensorDtoSchema);

export type SwitchDto = z.infer<typeof switchDtoSchema>;
export type SensorDto = z.infer<typeof sensorDtoSchema>;
