import { Router } from 'express';
import { DeviceService } from '../domain/DeviceService';
import { SensorController } from './SensorController';
import { SwitchController } from './SwitchController';

export function createApiRouter(deviceService: DeviceService): Router {
  const switchController = new SwitchController(deviceService);
  const sensorController = new SensorController(deviceService);

  const router = Router();
  router.get('/switches', switchController.getSwitches);
  router.get('/sensors', sensorController.getSensors);
  return router;
}
