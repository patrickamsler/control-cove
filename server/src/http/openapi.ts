import { z } from 'zod';
import { sensorDtoSchema, switchDtoSchema } from '@control-cove/shared';

const toSchema = (schema: z.ZodType) => z.toJSONSchema(schema, { target: 'openapi-3.0' });

const arrayOf = (name: string) => ({
  type: 'array' as const,
  items: { $ref: `#/components/schemas/${name}` },
});

const listEndpoint = (summary: string, description: string, name: string) => ({
  summary,
  description,
  tags: ['Devices'],
  responses: {
    '200': {
      description: summary,
      content: { 'application/json': { schema: arrayOf(name) } },
    },
  },
});

/**
 * The OpenAPI document. The schemas are generated from the same shared zod
 * schemas the client validates responses against, so the docs cannot drift
 * from the actual payloads.
 */
export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Control Cove API',
    version: '1.0.0',
    description:
      'Read the configured MQTT devices and their latest known state. State is kept ' +
      'in memory only, so state, temperature and humidity are absent until the ' +
      'device has published since the server started.',
  },
  tags: [{ name: 'Devices', description: 'Configured switches and environment sensors' }],
  paths: {
    '/api/switches': {
      get: listEndpoint('List switches', 'All configured switches with their latest known state.', 'Switch'),
    },
    '/api/sensors': {
      get: listEndpoint('List sensors', 'All configured environment sensors with their latest reading.', 'Sensor'),
    },
  },
  components: {
    schemas: {
      Switch: toSchema(switchDtoSchema),
      Sensor: toSchema(sensorDtoSchema),
    },
  },
};
