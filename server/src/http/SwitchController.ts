import { Request, Response } from 'express';
import { DeviceService } from '../domain/DeviceService';

export class SwitchController {
  constructor(private deviceService: DeviceService) {}

  public getSwitches = (req: Request, res: Response) => {
    res.json(this.deviceService.getSwitches());
  };
}
