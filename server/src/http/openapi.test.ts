import { describe, expect, it } from 'vitest';
import { openApiDocument } from './openapi';

describe('the OpenAPI document', () => {
  it('documents both device endpoints', () => {
    expect(Object.keys(openApiDocument.paths)).toEqual(['/api/switches', '/api/sensors']);
  });

  it('derives the schemas from the shared DTOs', () => {
    expect(openApiDocument.components.schemas.Switch).toMatchObject({
      type: 'object',
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' },
        state: { type: 'boolean' },
      },
      required: ['id', 'name'],
    });
    expect(openApiDocument.components.schemas.Sensor).toMatchObject({
      type: 'object',
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' },
        temperature: { type: 'number' },
        humidity: { type: 'number' },
      },
      required: ['id', 'name'],
    });
  });

  it('describes each response as an array of the matching schema', () => {
    const responseSchema = (path: '/api/switches' | '/api/sensors') =>
      openApiDocument.paths[path].get.responses['200'].content['application/json'].schema;

    expect(responseSchema('/api/switches').items.$ref).toBe('#/components/schemas/Switch');
    expect(responseSchema('/api/sensors').items.$ref).toBe('#/components/schemas/Sensor');
  });
});
