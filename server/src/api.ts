import { Request, Response, Express } from 'express';
import sensorConfig from './config/sensor-config.json';
import switchConfig from './config/light-config.json';
import { ConfigDto } from "./dto/config-dto";

export function setupRestEndpoints(app: Express) {
  app.get('/api/config', (req: Request, res: Response) => {
    res.json(createConfigDto());
  });
}

function createConfigDto(): ConfigDto {
  return {
    switches: switchConfig.map((config) => ({id: config.id, name: config.name})),
    sensors: sensorConfig.map((config) => ({id: config.id, name: config.name}))
  };
}