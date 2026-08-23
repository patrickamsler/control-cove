import { SensorDto, SwitchDto, sensorListSchema, switchListSchema } from '@control-cove/shared';
import { SERVER_URL } from './config';

const get = async <T>(path: string, schema: { parse: (data: unknown) => T }): Promise<T> => {
  const response = await fetch(`${SERVER_URL}${path}`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return schema.parse(await response.json());
};

export const fetchSwitches = (): Promise<SwitchDto[]> => get('/api/switches', switchListSchema);

export const fetchSensors = (): Promise<SensorDto[]> => get('/api/sensors', sensorListSchema);
