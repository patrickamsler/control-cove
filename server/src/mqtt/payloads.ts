import { z } from 'zod';

/**
 * Sensor status topics carry JSON. `device_id` is the identifier the device
 * reports for itself; it is kept server-internal (see DeviceService.SensorReading)
 * and is deliberately not part of the SensorDto sent to clients.
 */
export const sensorPayloadSchema = z.object({
  temperature: z.number(),
  humidity: z.number(),
  // A junk id must not cost us an otherwise valid reading, so it degrades to
  // undefined (and then to the topic) instead of failing the whole payload.
  device_id: z.string().optional().catch(undefined),
});

/** Switch state topics carry the plain strings `on` / `off`. */
export const switchPayloadSchema = z.enum(['on', 'off']);

export type SensorPayload = z.infer<typeof sensorPayloadSchema>;
