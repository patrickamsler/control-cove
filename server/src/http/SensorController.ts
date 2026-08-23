import { Request, Response } from 'express';
import { DeviceService } from '../domain/DeviceService';

export class SensorController {
  constructor(private deviceService: DeviceService) {}

  public getSensors = (req: Request, res: Response) => {
    res.json(this.deviceService.getSensors());
  };
}
